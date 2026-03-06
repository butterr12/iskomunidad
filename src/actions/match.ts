"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
  matchProfile,
  matchProfilePrompt,
  matchPromptPool,
  matchSwipe,
  matchMatch,
  cmSession,
  cmSessionParticipant,
  cmBlock,
} from "@/lib/schema";
import { and, eq, ne, notInArray, inArray, desc, sql, gte } from "drizzle-orm";
import {
  type ActionResult,
  getSession,
  getMatchDailySwipeLimit,
  guardAction,
  requireAdmin,
  requireCampusMatch,
} from "./_helpers";

// ─── Constants ───────────────────────────────────────────────────────────────

const MATCH_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours

// ─── Schemas ─────────────────────────────────────────────────────────────────

const saveProfileSchema = z.object({
  interests: z.array(z.string().trim().min(1).max(50)).min(3).max(5),
  prompts: z.array(
    z.object({
      promptId: z.string().uuid(),
      answer: z.string().trim().min(1).max(200),
      sortOrder: z.number().int().min(0),
    }),
  ).min(2).max(3),
});

const swipeSchema = z.object({
  targetId: z.string().min(1),
  direction: z.enum(["like", "pass"]),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type MatchProfileCard = {
  userId: string;
  college: string | null;
  year: string | null;
  interests: string[];
  prompts: Array<{
    promptText: string;
    category: string;
    answer: string;
  }>;
};

export type MatchResult = {
  matched: false;
} | {
  matched: true;
  matchId: string;
  sessionId: string;
};

// ─── Prompt Pool (public read) ───────────────────────────────────────────────

export async function getActivePrompts(): Promise<
  ActionResult<Array<{
    id: string;
    category: string;
    promptText: string;
    sortOrder: number;
  }>>
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const prompts = await db
    .select({
      id: matchPromptPool.id,
      category: matchPromptPool.category,
      promptText: matchPromptPool.promptText,
      sortOrder: matchPromptPool.sortOrder,
    })
    .from(matchPromptPool)
    .where(eq(matchPromptPool.isActive, true))
    .orderBy(matchPromptPool.category, matchPromptPool.sortOrder);

  return { success: true, data: prompts };
}

// ─── Profile CRUD ────────────────────────────────────────────────────────────

export async function getMyMatchProfile(): Promise<
  ActionResult<{
    profile: {
      id: string;
      interests: string[];
      isActive: boolean;
    };
    prompts: Array<{
      promptId: string;
      answer: string;
      sortOrder: number;
    }>;
  } | null>
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const profile = await db.query.matchProfile.findFirst({
    where: eq(matchProfile.userId, session.user.id),
    with: {
      prompts: {
        columns: {
          promptId: true,
          answer: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!profile) return { success: true, data: null };

  return {
    success: true,
    data: {
      profile: {
        id: profile.id,
        interests: profile.interests,
        isActive: profile.isActive,
      },
      prompts: profile.prompts,
    },
  };
}

export async function saveMatchProfile(
  input: z.infer<typeof saveProfileSchema>,
): Promise<ActionResult<{ profileId: string }>> {
  const parsed = saveProfileSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const cmCheck = await requireCampusMatch();
  if (cmCheck) return cmCheck;

  const limited = await guardAction("post.create", {
    userId: session.user.id,
    contentBody: parsed.data.prompts.map((p) => p.answer).join(" "),
  });
  if (limited) return limited;

  // Validate all promptIds exist and are active
  const promptIds = parsed.data.prompts.map((p) => p.promptId);
  const validPrompts = await db
    .select({ id: matchPromptPool.id })
    .from(matchPromptPool)
    .where(and(inArray(matchPromptPool.id, promptIds), eq(matchPromptPool.isActive, true)));

  if (validPrompts.length !== promptIds.length) {
    return { success: false, error: "One or more selected prompts are invalid" };
  }

  // Upsert profile
  const existing = await db.query.matchProfile.findFirst({
    where: eq(matchProfile.userId, session.user.id),
    columns: { id: true },
  });

  let profileId: string;

  if (existing) {
    profileId = existing.id;
    await db
      .update(matchProfile)
      .set({ interests: parsed.data.interests })
      .where(eq(matchProfile.id, existing.id));

    // Replace prompts
    await db.delete(matchProfilePrompt).where(eq(matchProfilePrompt.profileId, existing.id));
  } else {
    const [row] = await db
      .insert(matchProfile)
      .values({
        userId: session.user.id,
        interests: parsed.data.interests,
      })
      .returning({ id: matchProfile.id });
    profileId = row.id;
  }

  // Insert prompts
  await db.insert(matchProfilePrompt).values(
    parsed.data.prompts.map((p) => ({
      profileId,
      promptId: p.promptId,
      answer: p.answer,
      sortOrder: p.sortOrder,
    })),
  );

  return { success: true, data: { profileId } };
}

// ─── Swipe Deck ──────────────────────────────────────────────────────────────

export async function getSwipeDeck(): Promise<ActionResult<{
  cards: MatchProfileCard[];
  swipesRemaining: number;
  swipeLimit: number;
}>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const cmCheck = await requireCampusMatch();
  if (cmCheck) return cmCheck;

  const userId = session.user.id;

  // Check user has a profile
  const myProfile = await db.query.matchProfile.findFirst({
    where: and(eq(matchProfile.userId, userId), eq(matchProfile.isActive, true)),
    columns: { id: true },
  });
  if (!myProfile) return { success: false, error: "Create your match profile first" };

  // Get daily swipe limit + count today's swipes
  const swipeLimit = await getMatchDailySwipeLimit();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: todaySwipes }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchSwipe)
    .where(
      and(
        eq(matchSwipe.swiperId, userId),
        gte(matchSwipe.createdAt, todayStart),
      ),
    );

  const swipesRemaining = Math.max(0, swipeLimit - todaySwipes);

  if (swipesRemaining === 0) {
    return { success: true, data: { cards: [], swipesRemaining: 0, swipeLimit } };
  }

  // Get users I've already swiped on
  const swipedIds = await db
    .select({ targetId: matchSwipe.targetId })
    .from(matchSwipe)
    .where(eq(matchSwipe.swiperId, userId));

  const excludeIds = [userId, ...swipedIds.map((s) => s.targetId)];

  // Get users who blocked me or I blocked
  const blocks = await db
    .select({ blockerId: cmBlock.blockerId, blockedId: cmBlock.blockedId })
    .from(cmBlock)
    .where(
      sql`${cmBlock.blockerId} = ${userId} OR ${cmBlock.blockedId} = ${userId}`,
    );

  for (const b of blocks) {
    if (b.blockerId === userId) excludeIds.push(b.blockedId);
    else excludeIds.push(b.blockerId);
  }

  // Fetch eligible profiles (active, not excluded)
  const profiles = await db.query.matchProfile.findMany({
    where: and(
      eq(matchProfile.isActive, true),
      notInArray(matchProfile.userId, excludeIds),
    ),
    with: {
      prompts: {
        with: {
          prompt: {
            columns: { promptText: true, category: true },
          },
        },
        orderBy: (pp, { asc }) => [asc(pp.sortOrder)],
      },
      user: {
        columns: { university: true },
      },
    },
    limit: swipesRemaining + 5, // small buffer
  });

  const cards: MatchProfileCard[] = profiles.map((p) => ({
    userId: p.userId,
    college: p.user?.university ?? null,
    year: null, // Not in user schema — could be added later
    interests: p.interests,
    prompts: p.prompts.map((pp) => ({
      promptText: pp.prompt.promptText,
      category: pp.prompt.category,
      answer: pp.answer,
    })),
  }));

  return { success: true, data: { cards, swipesRemaining, swipeLimit } };
}

// ─── Record Swipe ────────────────────────────────────────────────────────────

export async function recordSwipe(
  input: z.infer<typeof swipeSchema>,
): Promise<ActionResult<MatchResult>> {
  const parsed = swipeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const cmCheck = await requireCampusMatch();
  if (cmCheck) return cmCheck;

  const limited = await guardAction("post.create", { userId: session.user.id });
  if (limited) return limited;

  const userId = session.user.id;
  const { targetId, direction } = parsed.data;

  if (targetId === userId) return { success: false, error: "Cannot swipe on yourself" };

  // Check daily limit
  const swipeLimit = await getMatchDailySwipeLimit();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: todaySwipes }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchSwipe)
    .where(
      and(
        eq(matchSwipe.swiperId, userId),
        gte(matchSwipe.createdAt, todayStart),
      ),
    );

  if (todaySwipes >= swipeLimit) {
    return { success: false, error: "Daily swipe limit reached" };
  }

  // Insert swipe (ignore conflict = already swiped)
  await db
    .insert(matchSwipe)
    .values({ swiperId: userId, targetId, direction })
    .onConflictDoNothing();

  // If pass, no match check needed
  if (direction === "pass") {
    return { success: true, data: { matched: false } };
  }

  // Check for mutual like
  const reciprocal = await db
    .select({ id: matchSwipe.id })
    .from(matchSwipe)
    .where(
      and(
        eq(matchSwipe.swiperId, targetId),
        eq(matchSwipe.targetId, userId),
        eq(matchSwipe.direction, "like"),
      ),
    )
    .limit(1);

  if (reciprocal.length === 0) {
    return { success: true, data: { matched: false } };
  }

  // Mutual match — create match + chat session
  return createMatch(userId, targetId);
}

// ─── Create Match (shared between swipe and like-back) ──────────────────────

async function createMatch(
  userIdRaw1: string,
  userIdRaw2: string,
): Promise<ActionResult<MatchResult>> {
  // Dedup: always store low/high
  const [userIdA, userIdB] = [userIdRaw1, userIdRaw2].sort();

  // Check if match already exists
  const existing = await db
    .select({ id: matchMatch.id })
    .from(matchMatch)
    .where(
      and(eq(matchMatch.userIdA, userIdA), eq(matchMatch.userIdB, userIdB)),
    )
    .limit(1);

  if (existing.length > 0) {
    return { success: true, data: { matched: false } };
  }

  const expiresAt = new Date(Date.now() + MATCH_EXPIRY_MS);

  // Create cmSession for the 48h chat
  const [sessionRow] = await db
    .insert(cmSession)
    .values({
      type: "campus_match",
      status: "active",
      expiresAt,
    })
    .returning({ id: cmSession.id });

  // Add participants
  await db.insert(cmSessionParticipant).values([
    { sessionId: sessionRow.id, userId: userIdA, alias: "Match A" },
    { sessionId: sessionRow.id, userId: userIdB, alias: "Match B" },
  ]);

  // Create match record
  const [matchRow] = await db
    .insert(matchMatch)
    .values({
      userIdA,
      userIdB,
      sessionId: sessionRow.id,
      status: "active",
      expiresAt,
    })
    .returning({ id: matchMatch.id });

  return {
    success: true,
    data: {
      matched: true,
      matchId: matchRow.id,
      sessionId: sessionRow.id,
    },
  };
}

// ─── Likes You Feed ──────────────────────────────────────────────────────────

export async function getLikesYouFeed(): Promise<ActionResult<{
  cards: MatchProfileCard[];
  count: number;
}>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const cmCheck = await requireCampusMatch();
  if (cmCheck) return cmCheck;

  const userId = session.user.id;

  // People who liked me, that I haven't swiped on yet
  const likesFromOthers = await db
    .select({ swiperId: matchSwipe.swiperId })
    .from(matchSwipe)
    .where(
      and(
        eq(matchSwipe.targetId, userId),
        eq(matchSwipe.direction, "like"),
      ),
    );

  const likerIds = likesFromOthers.map((l) => l.swiperId);
  if (likerIds.length === 0) {
    return { success: true, data: { cards: [], count: 0 } };
  }

  // Filter out ones I've already swiped on
  const mySwipes = await db
    .select({ targetId: matchSwipe.targetId })
    .from(matchSwipe)
    .where(
      and(
        eq(matchSwipe.swiperId, userId),
        inArray(matchSwipe.targetId, likerIds),
      ),
    );
  const alreadySwipedSet = new Set(mySwipes.map((s) => s.targetId));
  const unseenLikerIds = likerIds.filter((id) => !alreadySwipedSet.has(id));

  if (unseenLikerIds.length === 0) {
    return { success: true, data: { cards: [], count: 0 } };
  }

  // Fetch their profiles
  const profiles = await db.query.matchProfile.findMany({
    where: and(
      eq(matchProfile.isActive, true),
      inArray(matchProfile.userId, unseenLikerIds),
    ),
    with: {
      prompts: {
        with: {
          prompt: {
            columns: { promptText: true, category: true },
          },
        },
        orderBy: (pp, { asc }) => [asc(pp.sortOrder)],
      },
      user: {
        columns: { university: true },
      },
    },
  });

  const cards: MatchProfileCard[] = profiles.map((p) => ({
    userId: p.userId,
    college: p.user?.university ?? null,
    year: null,
    interests: p.interests,
    prompts: p.prompts.map((pp) => ({
      promptText: pp.prompt.promptText,
      category: pp.prompt.category,
      answer: pp.answer,
    })),
  }));

  return { success: true, data: { cards, count: cards.length } };
}

// ─── Get Likes You Count (for badge) ────────────────────────────────────────

export async function getLikesYouCount(): Promise<ActionResult<number>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const userId = session.user.id;

  const [result] = await db
    .select({
      count: sql<number>`count(DISTINCT ${matchSwipe.swiperId})::int`,
    })
    .from(matchSwipe)
    .where(
      and(
        eq(matchSwipe.targetId, userId),
        eq(matchSwipe.direction, "like"),
        sql`NOT EXISTS (
          SELECT 1 FROM match_swipe ms2
          WHERE ms2."swiper_id" = ${userId}
          AND ms2."target_id" = ${matchSwipe.swiperId}
        )`,
      ),
    );

  return { success: true, data: result?.count ?? 0 };
}

// ─── My Active Matches ──────────────────────────────────────────────────────

export async function getMyMatches(): Promise<ActionResult<Array<{
  matchId: string;
  sessionId: string | null;
  otherUserId: string;
  status: string;
  expiresAt: string;
  matchedAt: string;
}>>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const userId = session.user.id;

  const matches = await db
    .select()
    .from(matchMatch)
    .where(
      and(
        sql`(${matchMatch.userIdA} = ${userId} OR ${matchMatch.userIdB} = ${userId})`,
        eq(matchMatch.status, "active"),
      ),
    )
    .orderBy(desc(matchMatch.matchedAt));

  return {
    success: true,
    data: matches.map((m) => ({
      matchId: m.id,
      sessionId: m.sessionId,
      otherUserId: m.userIdA === userId ? m.userIdB : m.userIdA,
      status: m.status,
      expiresAt: m.expiresAt.toISOString(),
      matchedAt: m.matchedAt.toISOString(),
    })),
  };
}

// ─── Admin: Prompt Pool CRUD ─────────────────────────────────────────────────

const promptSchema = z.object({
  category: z.enum(["vulnerability", "taste", "campus", "flirty"]),
  promptText: z.string().trim().min(5).max(200),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function adminGetPrompts(): Promise<
  ActionResult<Array<{
    id: string;
    category: string;
    promptText: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
  }>>
> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const prompts = await db
    .select()
    .from(matchPromptPool)
    .orderBy(matchPromptPool.category, matchPromptPool.sortOrder);

  return {
    success: true,
    data: prompts.map((p) => ({
      id: p.id,
      category: p.category,
      promptText: p.promptText,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

export async function adminCreatePrompt(
  input: z.infer<typeof promptSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = promptSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const [row] = await db
    .insert(matchPromptPool)
    .values({
      category: parsed.data.category,
      promptText: parsed.data.promptText,
      isActive: parsed.data.isActive ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning({ id: matchPromptPool.id });

  return { success: true, data: { id: row.id } };
}

export async function adminUpdatePrompt(
  id: string,
  input: Partial<z.infer<typeof promptSchema>>,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const updates: Record<string, unknown> = {};
  if (input.category !== undefined) updates.category = input.category;
  if (input.promptText !== undefined) updates.promptText = input.promptText;
  if (input.isActive !== undefined) updates.isActive = input.isActive;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

  if (Object.keys(updates).length === 0) {
    return { success: false, error: "No updates provided" };
  }

  await db.update(matchPromptPool).set(updates).where(eq(matchPromptPool.id, id));

  return { success: true, data: undefined };
}

export async function adminDeletePrompt(id: string): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  await db.delete(matchPromptPool).where(eq(matchPromptPool.id, id));

  return { success: true, data: undefined };
}
