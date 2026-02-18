"use server";

import { db } from "@/lib/db";
import {
  userFollow,
  userPrivacySetting,
  communityPost,
  postVote,
} from "@/lib/schema";
import { user } from "@/lib/auth-schema";
import { eq, and, count } from "drizzle-orm";
import {
  type ActionResult,
  getSessionOrThrow,
  getOptionalSession,
  createUserNotification,
} from "./_helpers";

function getActorLabel(u: { username?: string | null; name?: string | null }): string {
  return u.username ? `@${u.username}` : (u.name ?? "Someone");
}

// ─── Follow a user ──────────────────────────────────────────────────────────

export async function followUser(
  targetId: string,
): Promise<ActionResult<void>> {
  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  if (session.user.id === targetId) {
    return { success: false, error: "You cannot follow yourself" };
  }

  // Check target exists
  const target = await db.query.user.findFirst({
    where: eq(user.id, targetId),
    columns: { id: true, name: true, username: true },
  });
  if (!target) return { success: false, error: "User not found" };

  // Check privacy settings
  const privacy = await db.query.userPrivacySetting.findFirst({
    where: eq(userPrivacySetting.userId, targetId),
  });
  if (privacy?.allowFollowsFrom === "nobody") {
    return { success: false, error: "This user is not accepting follows" };
  }

  // Check if already following
  const existing = await db.query.userFollow.findFirst({
    where: and(
      eq(userFollow.followerId, session.user.id),
      eq(userFollow.followingId, targetId),
    ),
  });
  if (existing) return { success: true, data: undefined };

  await db.insert(userFollow).values({
    followerId: session.user.id,
    followingId: targetId,
  });

  // Notify the target user
  await createUserNotification({
    userId: targetId,
    type: "new_follower",
    contentType: "post", // closest content type
    targetId: session.user.id,
    targetTitle: target.name ?? "your profile",
    actor: getActorLabel(session.user),
  });

  return { success: true, data: undefined };
}

// ─── Unfollow a user ────────────────────────────────────────────────────────

export async function unfollowUser(
  targetId: string,
): Promise<ActionResult<void>> {
  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  await db
    .delete(userFollow)
    .where(
      and(
        eq(userFollow.followerId, session.user.id),
        eq(userFollow.followingId, targetId),
      ),
    );

  return { success: true, data: undefined };
}

// ─── Get followers of a user ────────────────────────────────────────────────

export type FollowUser = {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
};

export async function getFollowers(
  userId: string,
): Promise<ActionResult<FollowUser[]>> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
    })
    .from(userFollow)
    .innerJoin(user, eq(userFollow.followerId, user.id))
    .where(eq(userFollow.followingId, userId))
    .orderBy(userFollow.createdAt);

  return { success: true, data: rows };
}

// ─── Get who a user is following ────────────────────────────────────────────

export async function getFollowing(
  userId: string,
): Promise<ActionResult<FollowUser[]>> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
    })
    .from(userFollow)
    .innerJoin(user, eq(userFollow.followingId, user.id))
    .where(eq(userFollow.followerId, userId))
    .orderBy(userFollow.createdAt);

  return { success: true, data: rows };
}

// ─── Get follow status between current user and target ──────────────────────

export type FollowStatus = {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
};

export async function getFollowStatus(
  targetId: string,
): Promise<ActionResult<FollowStatus>> {
  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  if (session.user.id === targetId) {
    return { success: true, data: { isFollowing: false, isFollowedBy: false, isMutual: false } };
  }

  const [following, followedBy] = await Promise.all([
    db.query.userFollow.findFirst({
      where: and(
        eq(userFollow.followerId, session.user.id),
        eq(userFollow.followingId, targetId),
      ),
    }),
    db.query.userFollow.findFirst({
      where: and(
        eq(userFollow.followerId, targetId),
        eq(userFollow.followingId, session.user.id),
      ),
    }),
  ]);

  const isFollowing = !!following;
  const isFollowedBy = !!followedBy;

  return {
    success: true,
    data: { isFollowing, isFollowedBy, isMutual: isFollowing && isFollowedBy },
  };
}

// ─── Get follow counts for a user ───────────────────────────────────────────

export type FollowCounts = {
  followerCount: number;
  followingCount: number;
};

export async function getFollowCounts(
  userId: string,
): Promise<ActionResult<FollowCounts>> {
  const [followers, following] = await Promise.all([
    db
      .select({ count: count() })
      .from(userFollow)
      .where(eq(userFollow.followingId, userId)),
    db
      .select({ count: count() })
      .from(userFollow)
      .where(eq(userFollow.followerId, userId)),
  ]);

  return {
    success: true,
    data: {
      followerCount: followers[0].count,
      followingCount: following[0].count,
    },
  };
}

// ─── Get / Update privacy settings ─────────────────────────────────────────

export type PrivacySettings = {
  allowFollowsFrom: string;
  allowMessagesFrom: string;
};

export async function getPrivacySettings(): Promise<ActionResult<PrivacySettings>> {
  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  const row = await db.query.userPrivacySetting.findFirst({
    where: eq(userPrivacySetting.userId, session.user.id),
  });

  return {
    success: true,
    data: {
      allowFollowsFrom: row?.allowFollowsFrom ?? "everyone",
      allowMessagesFrom: row?.allowMessagesFrom ?? "everyone",
    },
  };
}

export async function updatePrivacySettings(
  settings: PrivacySettings,
): Promise<ActionResult<PrivacySettings>> {
  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  const valid = ["everyone", "nobody"];
  if (!valid.includes(settings.allowFollowsFrom) || !valid.includes(settings.allowMessagesFrom)) {
    return { success: false, error: "Invalid privacy setting value" };
  }

  await db
    .insert(userPrivacySetting)
    .values({
      userId: session.user.id,
      allowFollowsFrom: settings.allowFollowsFrom,
      allowMessagesFrom: settings.allowMessagesFrom,
    })
    .onConflictDoUpdate({
      target: userPrivacySetting.userId,
      set: {
        allowFollowsFrom: settings.allowFollowsFrom,
        allowMessagesFrom: settings.allowMessagesFrom,
      },
    });

  return { success: true, data: settings };
}

// ─── Get user profile by username ───────────────────────────────────────────

export type UserProfile = {
  id: string;
  name: string;
  username: string | null;
  displayUsername: string | null;
  image: string | null;
  createdAt: string;
  followerCount: number;
  followingCount: number;
};

export async function getUserProfile(
  username: string,
): Promise<ActionResult<UserProfile>> {
  const row = await db.query.user.findFirst({
    where: eq(user.username, username.toLowerCase()),
    columns: {
      id: true,
      name: true,
      username: true,
      displayUsername: true,
      image: true,
      createdAt: true,
    },
  });

  if (!row) return { success: false, error: "User not found" };

  const countsRes = await getFollowCounts(row.id);
  const counts = countsRes.success ? countsRes.data : { followerCount: 0, followingCount: 0 };

  return {
    success: true,
    data: {
      ...row,
      createdAt: row.createdAt.toISOString(),
      ...counts,
    },
  };
}

// ─── Get user's approved posts ──────────────────────────────────────────────

export async function getUserPosts(
  userId: string,
): Promise<ActionResult<unknown[]>> {
  const session = await getOptionalSession();

  const rows = await db.query.communityPost.findMany({
    where: and(
      eq(communityPost.userId, userId),
      eq(communityPost.status, "approved"),
    ),
    with: {
      user: { columns: { name: true, username: true, image: true } },
    },
    orderBy: (p, { desc: d }) => [d(p.createdAt)],
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
