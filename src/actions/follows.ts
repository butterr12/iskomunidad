"use server";

import { db } from "@/lib/db";
import {
  userFollow,
  userPrivacySetting,
  communityPost,
  postVote,
  userSelectedBorder,
} from "@/lib/schema";
import { user } from "@/lib/auth-schema";
import { eq, and, count, ilike, or, ne, inArray, notInArray, isNotNull } from "drizzle-orm";
import {
  type ActionResult,
  getSession,
  getOptionalSession,
  createUserNotification,
  guardAction,
  rateLimit,
} from "./_helpers";
import { getBorderById, type BorderDefinition } from "@/lib/profile-borders";

function getActorLabel(u: { username?: string | null; name?: string | null }): string {
  return u.username ? `@${u.username}` : (u.name ?? "Someone");
}

// ─── Follow a user ──────────────────────────────────────────────────────────

export async function followUser(
  targetId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const followLimited = await guardAction("follow.toggle", { userId: session.user.id });
  if (followLimited) return followLimited;

  if (session.user.id === targetId) {
    return { success: false, error: "You cannot follow yourself" };
  }

  // Check target exists and is active
  const target = await db.query.user.findFirst({
    where: and(eq(user.id, targetId), eq(user.status, "active")),
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

  const inserted = await db.insert(userFollow).values({
    followerId: session.user.id,
    followingId: targetId,
  }).onConflictDoNothing({
    target: [userFollow.followerId, userFollow.followingId],
  }).returning({ id: userFollow.id });

  if (inserted.length > 0) {
    // Notify the target user only on new follow
    await createUserNotification({
      userId: targetId,
      type: "new_follower",
      contentType: "post", // closest content type
      targetId: session.user.id,
      targetTitle: target.name ?? "your profile",
      actor: getActorLabel(session.user),
    });
  }

  return { success: true, data: undefined };
}

// ─── Unfollow a user ────────────────────────────────────────────────────────

export async function unfollowUser(
  targetId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const limited = await guardAction("follow.toggle", { userId: session.user.id });
  if (limited) return limited;

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
    .where(and(eq(userFollow.followingId, userId), eq(user.status, "active")))
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
    .where(and(eq(userFollow.followerId, userId), eq(user.status, "active")))
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
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  if (session.user.id === targetId) {
    return { success: true, data: { isFollowing: false, isFollowedBy: false, isMutual: false } };
  }

  const target = await db.query.user.findFirst({
    where: and(eq(user.id, targetId), eq(user.status, "active")),
    columns: { id: true },
  });
  if (!target) return { success: false, error: "User not found" };

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
  const session = await getSession();
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
  const session = await getSession();
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
  border: BorderDefinition | null;
};

export async function getUserProfile(
  username: string,
): Promise<ActionResult<UserProfile>> {
  const row = await db.query.user.findFirst({
    where: and(eq(user.username, username.toLowerCase()), eq(user.status, "active")),
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

  const [countsRes, borderRow] = await Promise.all([
    getFollowCounts(row.id),
    db.query.userSelectedBorder.findFirst({
      where: eq(userSelectedBorder.userId, row.id),
    }),
  ]);
  const counts = countsRes.success ? countsRes.data : { followerCount: 0, followingCount: 0 };
  const border = borderRow ? getBorderById(borderRow.borderId) : null;

  return {
    success: true,
    data: {
      ...row,
      createdAt: row.createdAt.toISOString(),
      ...counts,
      border,
    },
  };
}

// ─── Search users by name or username ────────────────────────────────────────

export type UserSearchResult = {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
};

export type MentionCandidate = {
  id: string;
  name: string;
  username: string;
  image: string | null;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
};

export async function searchUsers(
  query: string,
): Promise<ActionResult<UserSearchResult[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const trimmed = query.trim();
  if (!trimmed) return { success: true, data: [] };

  const pattern = `%${trimmed}%`;

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
    })
    .from(user)
    .where(
      and(
        or(ilike(user.name, pattern), ilike(user.username, pattern)),
        eq(user.status, "active"),
        ne(user.id, session.user.id),
      ),
    )
    .limit(10);

  return { success: true, data: rows };
}

function getMentionTextRank(candidate: { username: string; name: string }, query: string): number {
  if (!query) return 0; // no text to rank — sort purely by social rank

  const username = candidate.username.toLowerCase();
  const name = candidate.name.toLowerCase();

  if (username === query) return 0;
  if (username.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (username.includes(query)) return 3;
  return 4;
}

function getMentionSocialRank(flags: {
  isFollowing: boolean;
  isFollowedBy: boolean;
}): number {
  if (flags.isFollowing && flags.isFollowedBy) return 0; // mutual
  if (flags.isFollowing) return 1;
  if (flags.isFollowedBy) return 2;
  return 3;
}

type MentionCandidateRow = { id: string; name: string; username: string; image: string | null };

async function getDefaultMentionCandidates(userId: string): Promise<{
  candidates: MentionCandidateRow[];
  followingSet: Set<string>;
  followerSet: Set<string>;
}> {
  const [followingRows, followerRows] = await Promise.all([
    db
      .select({ userId: userFollow.followingId })
      .from(userFollow)
      .where(eq(userFollow.followerId, userId))
      .limit(200),
    db
      .select({ userId: userFollow.followerId })
      .from(userFollow)
      .where(eq(userFollow.followingId, userId))
      .limit(200),
  ]);

  const followingSet = new Set(followingRows.map((r) => r.userId));
  const followerSet = new Set(followerRows.map((r) => r.userId));
  const socialIds = [...new Set([...followingSet, ...followerSet])];

  let candidates: MentionCandidateRow[] = [];

  if (socialIds.length > 0) {
    const socialUsers = await db
      .select({ id: user.id, name: user.name, username: user.username, image: user.image })
      .from(user)
      .where(
        and(
          eq(user.status, "active"),
          isNotNull(user.username),
          ne(user.id, userId),
          inArray(user.id, socialIds),
        ),
      )
      .orderBy(user.username)
      .limit(20);

    candidates = socialUsers.flatMap((row) =>
      row.username
        ? [{ id: row.id, name: row.name, username: row.username, image: row.image }]
        : [],
    );
  }

  // Fill remaining slots with other active users if social circle is small
  if (candidates.length < 10) {
    const excludeIds = [userId, ...candidates.map((c) => c.id)];
    const fillers = await db
      .select({ id: user.id, name: user.name, username: user.username, image: user.image })
      .from(user)
      .where(
        and(
          eq(user.status, "active"),
          isNotNull(user.username),
          notInArray(user.id, excludeIds),
        ),
      )
      .orderBy(user.username)
      .limit(10 - candidates.length);

    candidates = [
      ...candidates,
      ...fillers.flatMap((row) =>
        row.username
          ? [{ id: row.id, name: row.name, username: row.username, image: row.image }]
          : [],
      ),
    ];
  }

  return { candidates, followingSet, followerSet };
}

export async function searchMentionableUsers(
  query: string,
): Promise<ActionResult<MentionCandidate[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const limited = await rateLimit("general");
  if (limited) return limited;

  const trimmed = query.trim();
  const normalizedQuery = trimmed.toLowerCase();

  let candidates: MentionCandidateRow[];
  let followingSet: Set<string>;
  let followedBySet: Set<string>;

  if (trimmed) {
    // Text-based search: pull candidates matching query, then rank in memory
    const pattern = `%${trimmed}%`;
    const rawCandidates = await db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        image: user.image,
      })
      .from(user)
      .where(
        and(
          eq(user.status, "active"),
          isNotNull(user.username),
          ne(user.id, session.user.id),
          or(ilike(user.username, pattern), ilike(user.name, pattern)),
        ),
      )
      .orderBy(user.username)
      .limit(60);

    candidates = rawCandidates.flatMap((row) =>
      row.username
        ? [{ id: row.id, name: row.name, username: row.username, image: row.image }]
        : [],
    );

    if (candidates.length === 0) return { success: true, data: [] };

    const candidateIds = candidates.map((c) => c.id);
    const [followingRows, followedByRows] = await Promise.all([
      db
        .select({ userId: userFollow.followingId })
        .from(userFollow)
        .where(
          and(
            eq(userFollow.followerId, session.user.id),
            inArray(userFollow.followingId, candidateIds),
          ),
        ),
      db
        .select({ userId: userFollow.followerId })
        .from(userFollow)
        .where(
          and(
            eq(userFollow.followingId, session.user.id),
            inArray(userFollow.followerId, candidateIds),
          ),
        ),
    ]);

    followingSet = new Set(followingRows.map((row) => row.userId));
    followedBySet = new Set(followedByRows.map((row) => row.userId));
  } else {
    // Empty query: return default suggestions ranked by social proximity
    // Follow sets are returned alongside candidates to avoid redundant queries
    const result = await getDefaultMentionCandidates(session.user.id);
    candidates = result.candidates;
    followingSet = result.followingSet;
    followedBySet = result.followerSet;
  }

  if (candidates.length === 0) return { success: true, data: [] };

  const ranked = candidates
    .map((candidate) => {
      const isFollowing = followingSet.has(candidate.id);
      const isFollowedBy = followedBySet.has(candidate.id);
      const isMutual = isFollowing && isFollowedBy;

      return {
        ...candidate,
        isFollowing,
        isFollowedBy,
        isMutual,
        textRank: getMentionTextRank(candidate, normalizedQuery),
        socialRank: getMentionSocialRank({ isFollowing, isFollowedBy }),
      };
    })
    .sort((a, b) => {
      if (a.textRank !== b.textRank) return a.textRank - b.textRank;
      if (a.socialRank !== b.socialRank) return a.socialRank - b.socialRank;
      return a.username.toLowerCase().localeCompare(b.username.toLowerCase());
    })
    .slice(0, 10)
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      username: candidate.username,
      image: candidate.image,
      isFollowing: candidate.isFollowing,
      isFollowedBy: candidate.isFollowedBy,
      isMutual: candidate.isMutual,
    }));

  return { success: true, data: ranked };
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
