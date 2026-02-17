"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
  communityPost,
  postComment,
  postVote,
  commentVote,
} from "@/lib/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import {
  type ActionResult,
  getSessionOrThrow,
  getOptionalSession,
  getAutoApproveSetting,
  createNotification,
} from "./_helpers";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createPostSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  type: z.enum(["text", "link", "image"]),
  flair: z.string().min(1),
  locationId: z.string().uuid().optional(),
  linkUrl: z.string().optional(),
  imageColor: z.string().optional(),
  imageEmoji: z.string().optional(),
});

const voteSchema = z.object({
  value: z.number().int().min(-1).max(1),
});

const createCommentSchema = z.object({
  postId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  body: z.string().min(1),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getApprovedPosts(
  opts?: { sort?: "hot" | "new" | "top"; flair?: string },
): Promise<ActionResult<unknown[]>> {
  const session = await getOptionalSession();

  const rows = await db.query.communityPost.findMany({
    where: (p, { eq: e, and: a }) => {
      const conditions = [e(p.status, "approved")];
      if (opts?.flair) conditions.push(e(p.flair, opts.flair));
      return conditions.length === 1 ? conditions[0] : a(...conditions);
    },
    with: {
      user: { columns: { name: true, username: true, image: true } },
    },
    orderBy: (p, { desc: d }) => {
      if (opts?.sort === "top") return [d(p.score)];
      if (opts?.sort === "new") return [d(p.createdAt)];
      // "hot" default: sort by score then recency
      return [d(p.score), d(p.createdAt)];
    },
  });

  // Get current user's votes if logged in
  let userVotes: Record<string, number> = {};
  if (session?.user) {
    const votes = await db.query.postVote.findMany({
      where: eq(postVote.userId, session.user.id),
    });
    userVotes = Object.fromEntries(votes.map((v) => [v.postId, v.value]));
  }

  return {
    success: true,
    data: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      author: r.user.name,
      authorHandle: r.user.username ? `@${r.user.username}` : null,
      authorImage: r.user.image,
      userVote: userVotes[r.id] ?? 0,
    })),
  };
}

export async function getPostById(
  id: string,
): Promise<ActionResult<unknown>> {
  const session = await getOptionalSession();

  const row = await db.query.communityPost.findFirst({
    where: eq(communityPost.id, id),
    with: {
      user: { columns: { name: true, username: true, image: true } },
      comments: {
        with: {
          user: { columns: { name: true, username: true, image: true } },
        },
        orderBy: (c, { asc }) => [asc(c.createdAt)],
      },
    },
  });

  if (!row) return { success: false, error: "Post not found" };

  // Get user's votes on post and comments
  let postUserVote = 0;
  let commentUserVotes: Record<string, number> = {};
  if (session?.user) {
    const pv = await db.query.postVote.findFirst({
      where: and(
        eq(postVote.postId, id),
        eq(postVote.userId, session.user.id),
      ),
    });
    postUserVote = pv?.value ?? 0;

    const cvs = await db.query.commentVote.findMany({
      where: eq(commentVote.userId, session.user.id),
    });
    commentUserVotes = Object.fromEntries(
      cvs.map((v) => [v.commentId, v.value]),
    );
  }

  return {
    success: true,
    data: {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      author: row.user.name,
      authorHandle: row.user.username ? `@${row.user.username}` : null,
      authorImage: row.user.image,
      userVote: postUserVote,
      comments: row.comments.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        author: c.user.name,
        authorHandle: c.user.username ? `@${c.user.username}` : null,
        authorImage: c.user.image,
        userVote: commentUserVotes[c.id] ?? 0,
      })),
    },
  };
}

export async function createPost(
  input: z.infer<typeof createPostSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  const autoApprove = await getAutoApproveSetting();
  const status = autoApprove ? "approved" : "draft";

  const [created] = await db
    .insert(communityPost)
    .values({
      ...parsed.data,
      locationId: parsed.data.locationId ?? null,
      linkUrl: parsed.data.linkUrl ?? null,
      imageColor: parsed.data.imageColor ?? null,
      imageEmoji: parsed.data.imageEmoji ?? null,
      status,
      userId: session.user.id,
    })
    .returning({ id: communityPost.id });

  if (!autoApprove) {
    await createNotification({
      type: "post_pending",
      targetId: created.id,
      targetTitle: parsed.data.title,
      authorHandle: session.user.username ?? session.user.name,
    });
  }

  return { success: true, data: { id: created.id } };
}

export async function voteOnPost(
  postId: string,
  value: number,
): Promise<ActionResult<{ newScore: number }>> {
  const parsed = voteSchema.safeParse({ value });
  if (!parsed.success)
    return { success: false, error: "Value must be -1, 0, or 1" };

  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  if (parsed.data.value === 0) {
    // Delete existing vote
    await db
      .delete(postVote)
      .where(
        and(eq(postVote.postId, postId), eq(postVote.userId, session.user.id)),
      );
  } else {
    // Upsert vote
    await db
      .insert(postVote)
      .values({
        postId,
        userId: session.user.id,
        value: parsed.data.value,
      })
      .onConflictDoUpdate({
        target: [postVote.userId, postVote.postId],
        set: { value: parsed.data.value },
      });
  }

  // Recalculate score
  const [{ total }] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${postVote.value}), 0)`,
    })
    .from(postVote)
    .where(eq(postVote.postId, postId));

  const newScore = Number(total);
  await db
    .update(communityPost)
    .set({ score: newScore })
    .where(eq(communityPost.id, postId));

  return { success: true, data: { newScore } };
}

export async function createComment(
  input: z.infer<typeof createCommentSchema>,
): Promise<ActionResult<unknown>> {
  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  const [created] = await db
    .insert(postComment)
    .values({
      postId: parsed.data.postId,
      parentId: parsed.data.parentId ?? null,
      userId: session.user.id,
      body: parsed.data.body,
    })
    .returning();

  // Increment commentCount
  await db
    .update(communityPost)
    .set({
      commentCount: sql`${communityPost.commentCount} + 1`,
    })
    .where(eq(communityPost.id, parsed.data.postId));

  return {
    success: true,
    data: {
      ...created,
      createdAt: created.createdAt.toISOString(),
      author: session.user.name,
      authorHandle: session.user.username
        ? `@${session.user.username}`
        : null,
      authorImage: session.user.image,
    },
  };
}

export async function voteOnComment(
  commentId: string,
  value: number,
): Promise<ActionResult<{ newScore: number }>> {
  const parsed = voteSchema.safeParse({ value });
  if (!parsed.success)
    return { success: false, error: "Value must be -1, 0, or 1" };

  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  if (parsed.data.value === 0) {
    await db
      .delete(commentVote)
      .where(
        and(
          eq(commentVote.commentId, commentId),
          eq(commentVote.userId, session.user.id),
        ),
      );
  } else {
    await db
      .insert(commentVote)
      .values({
        commentId,
        userId: session.user.id,
        value: parsed.data.value,
      })
      .onConflictDoUpdate({
        target: [commentVote.userId, commentVote.commentId],
        set: { value: parsed.data.value },
      });
  }

  // Recalculate score
  const [{ total }] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${commentVote.value}), 0)`,
    })
    .from(commentVote)
    .where(eq(commentVote.commentId, commentId));

  const newScore = Number(total);
  await db
    .update(postComment)
    .set({ score: newScore })
    .where(eq(postComment.id, commentId));

  return { success: true, data: { newScore } };
}
