"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
  communityPost,
  postComment,
  postVote,
  commentVote,
  userFollow,
} from "@/lib/schema";
import { eq, sql, and, inArray } from "drizzle-orm";
import {
  type ActionResult,
  getSession,
  getOptionalSession,
  getApprovalMode,
  createNotification,
  createUserNotification,
  rateLimit,
} from "./_helpers";
import { moderateContent } from "@/lib/ai-moderation";

function getActorLabel(user: { username?: string | null; name?: string | null }): string {
  return user.username ? `@${user.username}` : (user.name ?? "Someone");
}

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

export async function getPostsForLandmark(
  landmarkId: string,
): Promise<ActionResult<unknown[]>> {
  const session = await getOptionalSession();

  const rows = await db.query.communityPost.findMany({
    where: (p, { eq: e, and: a }) =>
      a(e(p.status, "approved"), e(p.locationId, landmarkId)),
    with: {
      user: { columns: { name: true, username: true, image: true } },
    },
    orderBy: (p, { desc: d }) => [d(p.score), d(p.createdAt)],
  });

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

export async function getFollowingPosts(
  opts?: { sort?: "hot" | "new" | "top" },
): Promise<ActionResult<unknown[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  // Get IDs of users the current user follows
  const followedUserIds = db
    .select({ id: userFollow.followingId })
    .from(userFollow)
    .where(eq(userFollow.followerId, session.user.id));

  const rows = await db.query.communityPost.findMany({
    where: (p, { eq: e, and: a }) =>
      a(
        e(p.status, "approved"),
        inArray(p.userId, followedUserIds),
      ),
    with: {
      user: { columns: { name: true, username: true, image: true } },
    },
    orderBy: (p, { desc: d }) => {
      if (opts?.sort === "top") return [d(p.score)];
      if (opts?.sort === "new") return [d(p.createdAt)];
      return [d(p.score), d(p.createdAt)];
    },
  });

  // Get current user's votes
  const votes = await db.query.postVote.findMany({
    where: eq(postVote.userId, session.user.id),
  });
  const userVotes = Object.fromEntries(votes.map((v) => [v.postId, v.value]));

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

export async function getApprovedPostsPaginated(
  opts?: { sort?: "hot" | "new" | "top"; flair?: string; page?: number },
): Promise<ActionResult<{ posts: unknown[]; hasMore: boolean }>> {
  const session = await getOptionalSession();
  const PAGE_SIZE = 20;
  const page = opts?.page ?? 0;

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
      return [d(p.score), d(p.createdAt)];
    },
    limit: PAGE_SIZE + 1,
    offset: page * PAGE_SIZE,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  let userVotes: Record<string, number> = {};
  if (session?.user) {
    const votes = await db.query.postVote.findMany({
      where: eq(postVote.userId, session.user.id),
    });
    userVotes = Object.fromEntries(votes.map((v) => [v.postId, v.value]));
  }

  return {
    success: true,
    data: {
      posts: pageRows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        author: r.user.name,
        authorHandle: r.user.username ? `@${r.user.username}` : null,
        authorImage: r.user.image,
        userVote: userVotes[r.id] ?? 0,
      })),
      hasMore,
    },
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

  const isOwner = session?.user.id === row.userId;
  const isAdmin = session?.user.role === "admin";
  if (row.status !== "approved" && !isOwner && !isAdmin) {
    return { success: false, error: "Post not found" };
  }

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
      rejectionReason: (isAdmin || row.status === "rejected") ? row.rejectionReason : undefined,
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
): Promise<ActionResult<{ id: string; status: string }>> {
  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const mode = await getApprovalMode();
  let status: string;
  let rejectionReason: string | undefined;

  if (mode === "ai") {
    const result = await moderateContent({ type: "post", title: parsed.data.title, body: parsed.data.body });
    status = result.approved ? "approved" : "draft";
    rejectionReason = result.reason;
  } else {
    status = mode === "auto" ? "approved" : "draft";
  }

  const [created] = await db
    .insert(communityPost)
    .values({
      ...parsed.data,
      locationId: parsed.data.locationId ?? null,
      linkUrl: parsed.data.linkUrl ?? null,
      imageColor: parsed.data.imageColor ?? null,
      imageEmoji: parsed.data.imageEmoji ?? null,
      status,
      rejectionReason: rejectionReason ?? null,
      userId: session.user.id,
    })
    .returning({ id: communityPost.id });

  if (mode === "manual") {
    await createNotification({
      type: "post_pending",
      targetId: created.id,
      targetTitle: parsed.data.title,
      authorHandle: session.user.username ?? session.user.name,
    });
    await createUserNotification({
      userId: session.user.id,
      type: "post_pending",
      contentType: "post",
      targetId: created.id,
      targetTitle: parsed.data.title,
    });
  } else if (mode === "ai") {
    await createNotification({
      type: status === "approved" ? "post_approved" : "post_pending",
      targetId: created.id,
      targetTitle: parsed.data.title,
      authorHandle: session.user.username ?? session.user.name,
      reason: rejectionReason,
    });
    await createUserNotification({
      userId: session.user.id,
      type: status === "approved" ? "post_approved" : "post_pending",
      contentType: "post",
      targetId: created.id,
      targetTitle: parsed.data.title,
    });
  }

  return { success: true, data: { id: created.id, status } };
}

export async function voteOnPost(
  postId: string,
  value: number,
): Promise<ActionResult<{ newScore: number }>> {
  const parsed = voteSchema.safeParse({ value });
  if (!parsed.success)
    return { success: false, error: "Value must be -1, 0, or 1" };

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const post = await db.query.communityPost.findFirst({
    where: eq(communityPost.id, postId),
    columns: { status: true, userId: true, title: true },
  });
  if (!post || post.status !== "approved") {
    return { success: false, error: "Post not found" };
  }

  const existingVote = await db.query.postVote.findFirst({
    where: and(eq(postVote.postId, postId), eq(postVote.userId, session.user.id)),
    columns: { value: true },
  });
  const previousValue = existingVote?.value ?? 0;

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

  const shouldNotifyUpvote =
    parsed.data.value === 1 &&
    previousValue !== 1 &&
    post.userId !== session.user.id;
  if (shouldNotifyUpvote) {
    await createUserNotification({
      userId: post.userId,
      type: "post_upvoted",
      contentType: "post",
      targetId: postId,
      targetTitle: post.title,
      actor: getActorLabel(session.user),
    });
  }

  return { success: true, data: { newScore } };
}

export async function createComment(
  input: z.infer<typeof createCommentSchema>,
): Promise<ActionResult<unknown>> {
  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const post = await db.query.communityPost.findFirst({
    where: eq(communityPost.id, parsed.data.postId),
    columns: { status: true, userId: true, title: true },
  });
  if (!post || post.status !== "approved") {
    return { success: false, error: "Post not found" };
  }

  let parentComment: { userId: string; postId: string } | null = null;
  if (parsed.data.parentId) {
    parentComment =
      (await db.query.postComment.findFirst({
        where: eq(postComment.id, parsed.data.parentId),
        columns: { userId: true, postId: true },
      })) ?? null;
    if (!parentComment || parentComment.postId !== parsed.data.postId) {
      return { success: false, error: "Parent comment not found" };
    }
  }

  // AI moderation for comments (no status column — reject before inserting)
  const mode = await getApprovalMode();
  if (mode === "ai") {
    const result = await moderateContent({ type: "comment", body: parsed.data.body });
    if (!result.approved) {
      return { success: false, error: `Your comment was flagged: ${result.reason ?? "content policy violation"}` };
    }
  }

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

  const actor = getActorLabel(session.user);
  if (parsed.data.parentId && parentComment) {
    if (parentComment.userId !== session.user.id) {
      await createUserNotification({
        userId: parentComment.userId,
        type: "comment_replied",
        contentType: "post",
        targetId: parsed.data.postId,
        targetTitle: post.title,
        actor,
      });
    }
    if (post.userId !== session.user.id && post.userId !== parentComment.userId) {
      await createUserNotification({
        userId: post.userId,
        type: "post_commented",
        contentType: "post",
        targetId: parsed.data.postId,
        targetTitle: post.title,
        actor,
      });
    }
  } else if (post.userId !== session.user.id) {
    await createUserNotification({
      userId: post.userId,
      type: "post_commented",
      contentType: "post",
      targetId: parsed.data.postId,
      targetTitle: post.title,
      actor,
    });
  }

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

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const comment = await db.query.postComment.findFirst({
    where: eq(postComment.id, commentId),
    columns: {
      userId: true,
      postId: true,
    },
    with: {
      post: {
        columns: {
          status: true,
          title: true,
        },
      },
    },
  });
  if (!comment || comment.post.status !== "approved") {
    return { success: false, error: "Comment not found" };
  }

  const existingVote = await db.query.commentVote.findFirst({
    where: and(
      eq(commentVote.commentId, commentId),
      eq(commentVote.userId, session.user.id),
    ),
    columns: { value: true },
  });
  const previousValue = existingVote?.value ?? 0;

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

  const shouldNotifyUpvote =
    parsed.data.value === 1 &&
    previousValue !== 1 &&
    comment.userId !== session.user.id;
  if (shouldNotifyUpvote) {
    await createUserNotification({
      userId: comment.userId,
      type: "comment_upvoted",
      contentType: "post",
      targetId: comment.postId,
      targetTitle: comment.post.title,
      actor: getActorLabel(session.user),
    });
  }

  return { success: true, data: { newScore } };
}
