"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
  communityPost,
  postImage,
  postComment,
  postVote,
  postBookmark,
  commentVote,
  userFollow,
  user,
} from "@/lib/schema";
import { eq, sql, and, inArray, ne } from "drizzle-orm";
import {
  type ActionResult,
  getSession,
  getOptionalSession,
  getApprovalMode,
  createNotification,
  createUserNotification,
  guardAction,
} from "./_helpers";
import { moderateContent } from "@/lib/ai-moderation";
import { extractMentionUsernames } from "@/lib/mentions";
import { safeLinkUrl } from "@/lib/validation/url";

function getActorLabel(user: { username?: string | null; name?: string | null }): string {
  return user.username ? `@${user.username}` : (user.name ?? "Someone");
}

async function resolveMentionTargets(
  text: string,
  actorUserId: string,
): Promise<Array<{ id: string; username: string }>> {
  const usernames = extractMentionUsernames(text);
  if (usernames.length === 0) return [];

  const rows = await db
    .select({
      id: user.id,
      username: user.username,
    })
    .from(user)
    .where(
      and(
        inArray(user.username, usernames),
        eq(user.status, "active"),
        ne(user.id, actorUserId),
      ),
    );

  return rows.flatMap((row) =>
    row.username ? [{ id: row.id, username: row.username }] : [],
  );
}

async function notifyMentionedUsers(data: {
  text: string;
  actorUserId: string;
  actorLabel: string;
  targetId: string;
  targetTitle: string;
  notificationType: "post_mentioned" | "comment_mentioned";
  skipUserIds?: Set<string>;
}) {
  const targets = await resolveMentionTargets(data.text, data.actorUserId);
  if (targets.length === 0) return;

  for (const target of targets) {
    if (data.skipUserIds?.has(target.id)) continue;

    await createUserNotification({
      userId: target.id,
      type: data.notificationType,
      contentType: "post",
      targetId: data.targetId,
      targetTitle: data.targetTitle,
      actor: data.actorLabel,
    });

    data.skipUserIds?.add(target.id);
  }
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createPostSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().max(10000).optional(),
  flair: z.string().min(1),
  locationId: z.string().uuid().optional(),
  linkUrl: safeLinkUrl,
  imageKeys: z.array(z.string()).max(4).optional(),
});

const voteSchema = z.object({
  value: z.number().int().min(-1).max(1),
});

const createCommentSchema = z.object({
  postId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  body: z.string().min(1).max(5000),
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
      images: { columns: { imageKey: true, order: true }, orderBy: (img, { asc }) => [asc(img.order)] },
    },
    orderBy: (p, { desc: d }) => {
      if (opts?.sort === "top") return [d(p.score)];
      if (opts?.sort === "new") return [d(p.createdAt)];
      // "hot" default: sort by score then recency
      return [d(p.score), d(p.createdAt)];
    },
  });

  // Get current user's votes and bookmarks if logged in
  let userVotes: Record<string, number> = {};
  let userBookmarks: Record<string, boolean> = {};
  if (session?.user) {
    const votes = await db.query.postVote.findMany({
      where: eq(postVote.userId, session.user.id),
    });
    userVotes = Object.fromEntries(votes.map((v) => [v.postId, v.value]));

    const bookmarks = await db.query.postBookmark.findMany({
      where: eq(postBookmark.userId, session.user.id),
      columns: { postId: true },
    });
    userBookmarks = Object.fromEntries(bookmarks.map((b) => [b.postId, true]));
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
      imageKeys: r.images.map((img) => img.imageKey),
      userVote: userVotes[r.id] ?? 0,
      isBookmarked: userBookmarks[r.id] ?? false,
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
      images: { columns: { imageKey: true, order: true }, orderBy: (img, { asc }) => [asc(img.order)] },
    },
    orderBy: (p, { desc: d }) => [d(p.score), d(p.createdAt)],
  });

  let userVotes: Record<string, number> = {};
  let userBookmarks: Record<string, boolean> = {};
  if (session?.user) {
    const votes = await db.query.postVote.findMany({
      where: eq(postVote.userId, session.user.id),
    });
    userVotes = Object.fromEntries(votes.map((v) => [v.postId, v.value]));

    const bookmarks = await db.query.postBookmark.findMany({
      where: eq(postBookmark.userId, session.user.id),
      columns: { postId: true },
    });
    userBookmarks = Object.fromEntries(bookmarks.map((b) => [b.postId, true]));
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
      imageKeys: r.images.map((img) => img.imageKey),
      userVote: userVotes[r.id] ?? 0,
      isBookmarked: userBookmarks[r.id] ?? false,
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
      images: { columns: { imageKey: true, order: true }, orderBy: (img, { asc }) => [asc(img.order)] },
    },
    orderBy: (p, { desc: d }) => {
      if (opts?.sort === "top") return [d(p.score)];
      if (opts?.sort === "new") return [d(p.createdAt)];
      return [d(p.score), d(p.createdAt)];
    },
  });

  // Get current user's votes and bookmarks
  const votes = await db.query.postVote.findMany({
    where: eq(postVote.userId, session.user.id),
  });
  const userVotes = Object.fromEntries(votes.map((v) => [v.postId, v.value]));

  const bookmarks = await db.query.postBookmark.findMany({
    where: eq(postBookmark.userId, session.user.id),
    columns: { postId: true },
  });
  const userBookmarks: Record<string, boolean> = Object.fromEntries(bookmarks.map((b) => [b.postId, true]));

  return {
    success: true,
    data: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      author: r.user.name,
      authorHandle: r.user.username ? `@${r.user.username}` : null,
      authorImage: r.user.image,
      imageKeys: r.images.map((img) => img.imageKey),
      userVote: userVotes[r.id] ?? 0,
      isBookmarked: userBookmarks[r.id] ?? false,
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
      images: { columns: { imageKey: true, order: true }, orderBy: (img, { asc }) => [asc(img.order)] },
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
  let userBookmarks: Record<string, boolean> = {};
  if (session?.user) {
    const votes = await db.query.postVote.findMany({
      where: eq(postVote.userId, session.user.id),
    });
    userVotes = Object.fromEntries(votes.map((v) => [v.postId, v.value]));

    const bookmarks = await db.query.postBookmark.findMany({
      where: eq(postBookmark.userId, session.user.id),
      columns: { postId: true },
    });
    userBookmarks = Object.fromEntries(bookmarks.map((b) => [b.postId, true]));
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
        imageKeys: r.images.map((img) => img.imageKey),
        userVote: userVotes[r.id] ?? 0,
        isBookmarked: userBookmarks[r.id] ?? false,
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
      images: { columns: { imageKey: true, order: true }, orderBy: (img, { asc }) => [asc(img.order)] },
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

  // Get user's votes, bookmarks, and comment votes
  let postUserVote = 0;
  let isBookmarked = false;
  let commentUserVotes: Record<string, number> = {};
  if (session?.user) {
    const pv = await db.query.postVote.findFirst({
      where: and(
        eq(postVote.postId, id),
        eq(postVote.userId, session.user.id),
      ),
    });
    postUserVote = pv?.value ?? 0;

    const bk = await db.query.postBookmark.findFirst({
      where: and(
        eq(postBookmark.postId, id),
        eq(postBookmark.userId, session.user.id),
      ),
    });
    isBookmarked = !!bk;

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
      imageKeys: row.images.map((img) => img.imageKey),
      userVote: postUserVote,
      isBookmarked,
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
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const limited = await guardAction("post.create", {
    userId: session.user.id,
    contentBody: (parsed.data.title ?? "") + (parsed.data.body ?? ""),
  });
  if (limited) return limited;

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

  const { imageKeys, ...postData } = parsed.data;
  const [created] = await db
    .insert(communityPost)
    .values({
      ...postData,
      type: "text",
      locationId: postData.locationId ?? null,
      linkUrl: postData.linkUrl ?? null,
      status,
      rejectionReason: rejectionReason ?? null,
      userId: session.user.id,
    })
    .returning({ id: communityPost.id });

  if (imageKeys && imageKeys.length > 0) {
    await db.insert(postImage).values(
      imageKeys.map((key, i) => ({
        postId: created.id,
        imageKey: key,
        order: i,
      })),
    );
  }

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

  if (status === "approved") {
    await notifyMentionedUsers({
      text: `${parsed.data.title}\n${parsed.data.body ?? ""}`,
      actorUserId: session.user.id,
      actorLabel: getActorLabel(session.user),
      targetId: created.id,
      targetTitle: parsed.data.title,
      notificationType: "post_mentioned",
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

  const voteLimited = await guardAction("post.vote", { userId: session.user.id });
  if (voteLimited) return voteLimited;

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

  // Recalculate score atomically
  const [{ score: newScore }] = await db
    .update(communityPost)
    .set({
      score: sql`COALESCE((SELECT SUM(${postVote.value}) FROM ${postVote} WHERE ${postVote.postId} = ${postId}), 0)`,
    })
    .where(eq(communityPost.id, postId))
    .returning({ score: communityPost.score });

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
  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const limited = await guardAction("comment.create", {
    userId: session.user.id,
    contentBody: parsed.data.body,
  });
  if (limited) return limited;

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

  const [created] = await db.transaction(async (tx) => {
    const [comment] = await tx
      .insert(postComment)
      .values({
        postId: parsed.data.postId,
        parentId: parsed.data.parentId ?? null,
        userId: session.user.id,
        body: parsed.data.body,
      })
      .returning();

    await tx
      .update(communityPost)
      .set({
        commentCount: sql`${communityPost.commentCount} + 1`,
      })
      .where(eq(communityPost.id, parsed.data.postId));

    return [comment];
  });

  const actor = getActorLabel(session.user);
  const notifiedUserIds = new Set<string>();
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
      notifiedUserIds.add(parentComment.userId);
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
      notifiedUserIds.add(post.userId);
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
    notifiedUserIds.add(post.userId);
  }

  await notifyMentionedUsers({
    text: parsed.data.body,
    actorUserId: session.user.id,
    actorLabel: actor,
    targetId: parsed.data.postId,
    targetTitle: post.title,
    notificationType: "comment_mentioned",
    skipUserIds: notifiedUserIds,
  });

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

  const cvLimited = await guardAction("comment.vote", { userId: session.user.id });
  if (cvLimited) return cvLimited;

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

  // Recalculate score atomically
  const [{ score: newScore }] = await db
    .update(postComment)
    .set({
      score: sql`COALESCE((SELECT SUM(${commentVote.value}) FROM ${commentVote} WHERE ${commentVote.commentId} = ${commentId}), 0)`,
    })
    .where(eq(postComment.id, commentId))
    .returning({ score: postComment.score });

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

export async function toggleBookmark(
  postId: string,
): Promise<ActionResult<{ isBookmarked: boolean }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const limited = await guardAction("post.bookmark", { userId: session.user.id });
  if (limited) return limited;

  const post = await db.query.communityPost.findFirst({
    where: and(eq(communityPost.id, postId), eq(communityPost.status, "approved")),
    columns: { id: true },
  });
  if (!post) return { success: false, error: "Post not found" };

  const [inserted] = await db
    .insert(postBookmark)
    .values({ postId, userId: session.user.id })
    .onConflictDoNothing({ target: [postBookmark.userId, postBookmark.postId] })
    .returning({ id: postBookmark.id });

  if (!inserted) {
    // Already bookmarked — remove it
    await db
      .delete(postBookmark)
      .where(
        and(
          eq(postBookmark.postId, postId),
          eq(postBookmark.userId, session.user.id),
        ),
      );
    return { success: true, data: { isBookmarked: false } };
  }

  return { success: true, data: { isBookmarked: true } };
}

export async function getBookmarkedPosts(
  opts?: { sort?: "hot" | "new" | "top" },
): Promise<ActionResult<unknown[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const bookmarkedPostIds = db
    .select({ id: postBookmark.postId })
    .from(postBookmark)
    .where(eq(postBookmark.userId, session.user.id));

  const rows = await db.query.communityPost.findMany({
    where: (p, { eq: e, and: a }) =>
      a(
        e(p.status, "approved"),
        inArray(p.id, bookmarkedPostIds),
      ),
    with: {
      user: { columns: { name: true, username: true, image: true } },
      images: { columns: { imageKey: true, order: true }, orderBy: (img, { asc }) => [asc(img.order)] },
    },
    orderBy: (p, { desc: d }) => {
      if (opts?.sort === "top") return [d(p.score)];
      if (opts?.sort === "new") return [d(p.createdAt)];
      return [d(p.score), d(p.createdAt)];
    },
  });

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
      imageKeys: r.images.map((img) => img.imageKey),
      userVote: userVotes[r.id] ?? 0,
      isBookmarked: true,
    })),
  };
}
