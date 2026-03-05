"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
  adminSetting,
  cmBlock,
  cmMessage,
  cmPreference,
  cmQueueEntry,
  cmRematchCooldown,
  cmReport,
  cmSession,
  cmSessionParticipant,
  conversation,
  conversationParticipant,
  userFollow,
} from "@/lib/schema";
import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import {
  type ActionResult,
  getCampusMatchEnabled,
  getSession,
  rateLimit,
  requireCampusMatch,
} from "./_helpers";

// ─── Constants ───────────────────────────────────────────────────────────────

const STALE_QUEUE_MS = 90_000;
const MATCH_ROUND_INTERVAL_MS = 30_000;
const REMATCH_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MATCH_ROUND_LOCK_KEY = "campus-match-round-v1";
const MATCH_ROUND_AT_KEY = "campusMatchLastRoundAt";
const CAMPUS_MATCH_INTERACTION_BLOCKED_ERROR = "You cannot interact with this user";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const aliasSchema = z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9 ]+$/);
const scopeSchema = z.enum(["same-campus", "all-campuses"]);
const sessionIdSchema = z.string().uuid();

const updatePreferenceSchema = z.object({
  allowAnonQueue: z.boolean().optional(),
  defaultAlias: aliasSchema.nullable().optional(),
  lastScope: scopeSchema.optional(),
});

const joinQueueSchema = z.object({
  alias: aliasSchema,
  scope: scopeSchema,
});

const sessionInputSchema = z.object({
  sessionId: sessionIdSchema,
});

const reportUserSchema = z.object({
  sessionId: sessionIdSchema,
  reason: z.string().trim().min(1).max(500),
});

const sendMessageSchema = z
  .object({
    sessionId: sessionIdSchema,
    body: z.string().trim().max(2000).optional(),
    imageUrl: z.string().trim().min(1).optional(),
  })
  .refine((data) => Boolean(data.body?.trim() || data.imageUrl?.trim()), {
    message: "Message must have a body or image",
  });

// ─── Types ───────────────────────────────────────────────────────────────────

export type MatchScope = "same-campus" | "all-campuses";
export type QueueStatus = "idle" | "waiting" | "matched";
export type AnonSessionStatus = "active" | "ended" | "promoted";
export type ConnectState = "none" | "pending_me" | "pending_them" | "mutual";

export type CampusMatchPreferences = {
  allowAnonQueue: boolean;
  defaultAlias: string | null;
  lastScope: MatchScope;
};

export type CampusMatchState = {
  status: "idle" | "waiting" | "in_session";
  preferences: CampusMatchPreferences;
  queue: null | {
    scope: MatchScope;
    alias: string;
    waitingSince: string;
    nextRoundAt: string;
  };
  session: null | {
    conversationId: string;
    sessionStatus: AnonSessionStatus;
    myAlias: string;
    partnerAlias: string;
    connectState: ConnectState;
  };
};

type LegacyQueuePresence = {
  inQueue: boolean;
  inSession: boolean;
};

type QueueCandidate = {
  queueId: string;
  userId: string;
  alias: string;
  scope: MatchScope;
  university: string | null;
  createdAt: Date;
  heartbeatAt: Date;
};

type SessionParticipantRow = {
  userId: string;
  alias: string;
  connectRequested: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseBoolean(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1 || value === "1";
}

function parseDateLike(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function normalizeScope(value: string | null | undefined): MatchScope {
  return value === "all-campuses" ? "all-campuses" : "same-campus";
}

function normalizeCampus(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function pairKey(userA: string, userB: string): string {
  return userA < userB ? `${userA}:${userB}` : `${userB}:${userA}`;
}

function areScopesCompatible(a: QueueCandidate, b: QueueCandidate): boolean {
  if (a.scope === "all-campuses" && b.scope === "all-campuses") {
    return true;
  }

  const campusA = normalizeCampus(a.university);
  const campusB = normalizeCampus(b.university);
  return Boolean(campusA && campusB && campusA === campusB);
}

function findEligiblePairs(
  candidates: QueueCandidate[],
  blockedPairs: Set<string>,
  dmPairs: Set<string>,
  cooldownPairs: Set<string>,
): Array<[QueueCandidate, QueueCandidate]> {
  const used = new Set<string>();
  const pairs: Array<[QueueCandidate, QueueCandidate]> = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const a = candidates[i];
    if (used.has(a.userId)) continue;

    for (let j = i + 1; j < candidates.length; j += 1) {
      const b = candidates[j];
      if (used.has(b.userId)) continue;

      if (!areScopesCompatible(a, b)) continue;

      const key = pairKey(a.userId, b.userId);
      if (blockedPairs.has(key) || dmPairs.has(key) || cooldownPairs.has(key)) {
        continue;
      }

      used.add(a.userId);
      used.add(b.userId);
      pairs.push([a, b]);
      break;
    }
  }

  return pairs;
}

async function isGloballyBlocked(userA: string, userB: string): Promise<boolean> {
  const rows = await db
    .select({ id: cmBlock.id })
    .from(cmBlock)
    .where(
      or(
        and(eq(cmBlock.blockerId, userA), eq(cmBlock.blockedId, userB)),
        and(eq(cmBlock.blockerId, userB), eq(cmBlock.blockedId, userA)),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

async function getCampusMatchPreferencesForUser(userId: string): Promise<CampusMatchPreferences> {
  const pref = await db.query.cmPreference.findFirst({
    where: eq(cmPreference.userId, userId),
  });

  return {
    allowAnonQueue: pref?.allowAnonQueue ?? true,
    defaultAlias: pref?.defaultAlias ?? null,
    lastScope: normalizeScope(pref?.lastScope),
  };
}

async function getLastRoundAt(): Promise<Date | null> {
  const row = await db.query.adminSetting.findFirst({
    where: eq(adminSetting.key, MATCH_ROUND_AT_KEY),
  });

  if (!row) return null;
  if (typeof row.value === "string") return parseDateLike(row.value);
  return null;
}

function computeNextRoundAt(lastRoundAt: Date | null, now: Date): Date {
  if (!lastRoundAt) return new Date(now.getTime() + MATCH_ROUND_INTERVAL_MS);

  const elapsed = now.getTime() - lastRoundAt.getTime();
  if (elapsed >= MATCH_ROUND_INTERVAL_MS) {
    return new Date(now.getTime() + MATCH_ROUND_INTERVAL_MS);
  }

  return new Date(lastRoundAt.getTime() + MATCH_ROUND_INTERVAL_MS);
}

async function applyRematchCooldown(
  participantUserIds: string[],
  now: Date,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<void> {
  if (participantUserIds.length < 2) return;

  const [userA, userB] = participantUserIds.sort();
  const expiresAt = new Date(now.getTime() + REMATCH_COOLDOWN_MS);

  await tx
    .insert(cmRematchCooldown)
    .values({
      userIdLow: userA,
      userIdHigh: userB,
      expiresAt,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [cmRematchCooldown.userIdLow, cmRematchCooldown.userIdHigh],
      set: {
        expiresAt,
        createdAt: now,
      },
    });
}

async function closeActiveSession(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  sessionId: string,
  endedReason: string,
  now: Date,
): Promise<
  | { success: false; error: string }
  | { success: true; participants: SessionParticipantRow[] }
> {
  const sessionRows = await tx
    .select({
      id: cmSession.id,
      status: cmSession.status,
    })
    .from(cmSession)
    .where(eq(cmSession.id, sessionId))
    .limit(1);

  const sessionRow = sessionRows[0];
  if (!sessionRow || sessionRow.status !== "active") {
    return { success: false, error: "Session is no longer active" };
  }

  await tx.execute(
    sql`SELECT id FROM cm_session WHERE id = ${sessionId}::uuid AND status = 'active' FOR UPDATE`,
  );

  const participants = await tx
    .select({
      userId: cmSessionParticipant.userId,
      alias: cmSessionParticipant.alias,
      connectRequested: cmSessionParticipant.connectRequested,
    })
    .from(cmSessionParticipant)
    .where(eq(cmSessionParticipant.sessionId, sessionId));

  if (participants.length < 2) {
    return { success: false, error: "Session participant data is invalid" };
  }

  await tx
    .update(cmSession)
    .set({
      status: "ended",
      endedReason,
      endedAt: now,
    })
    .where(eq(cmSession.id, sessionId));

  await tx
    .update(cmSessionParticipant)
    .set({ connectRequested: false })
    .where(eq(cmSessionParticipant.sessionId, sessionId));

  await tx
    .delete(cmQueueEntry)
    .where(inArray(cmQueueEntry.userId, participants.map((p) => p.userId)));

  await applyRematchCooldown(
    participants.map((p) => p.userId),
    now,
    tx,
  );

  return {
    success: true,
    participants,
  };
}

async function promoteSessionToConversation(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  sessionId: string,
  participants: SessionParticipantRow[],
): Promise<void> {
  const now = new Date();

  await tx
    .insert(conversation)
    .values({
      id: sessionId,
      isRequest: false,
      deletedAt: null,
      deletedByUserId: null,
      deleteKind: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: conversation.id,
      set: {
        isRequest: false,
        deletedAt: null,
        deletedByUserId: null,
        deleteKind: null,
        updatedAt: now,
      },
    });

  await tx
    .insert(conversationParticipant)
    .values(
      participants.map((participant) => ({
        conversationId: sessionId,
        userId: participant.userId,
      })),
    )
    .onConflictDoNothing({
      target: [
        conversationParticipant.conversationId,
        conversationParticipant.userId,
      ],
    });

  await tx.execute(sql`
    INSERT INTO message (conversation_id, sender_id, body, image_url, created_at)
    SELECT ${sessionId}::uuid, sender_id, body, image_url, created_at
    FROM cm_message
    WHERE session_id = ${sessionId}::uuid
    ORDER BY created_at ASC
  `);

  if (participants.length >= 2) {
    const [userA, userB] = participants.map((p) => p.userId);
    await tx
      .insert(userFollow)
      .values([
        { followerId: userA, followingId: userB, createdAt: now },
        { followerId: userB, followingId: userA, createdAt: now },
      ])
      .onConflictDoNothing({
        target: [userFollow.followerId, userFollow.followingId],
      });
  }

  await tx
    .update(cmSession)
    .set({
      status: "promoted",
      endedReason: "mutual_connect",
      endedAt: now,
    })
    .where(eq(cmSession.id, sessionId));

  await tx
    .delete(cmQueueEntry)
    .where(inArray(cmQueueEntry.userId, participants.map((p) => p.userId)));
}

async function runCampusMatchRound(force = false): Promise<{ pairedCount: number }> {
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const lockResult = await tx.execute<{ locked: boolean | string }>(
      sql`SELECT pg_try_advisory_xact_lock(hashtext(${MATCH_ROUND_LOCK_KEY})) AS locked`,
    );
    const lockAcquired = parseBoolean(lockResult.rows[0]?.locked);

    if (!lockAcquired) {
      console.info("[campus-match] matching round skipped", {
        reason: "lock_busy",
      });
      return { pairedCount: 0 };
    }

    const staleCutoff = new Date(now.getTime() - STALE_QUEUE_MS);

    await tx
      .delete(cmQueueEntry)
      .where(sql`${cmQueueEntry.heartbeatAt} < ${staleCutoff}`);

    await tx.execute(sql`
      DELETE FROM cm_queue_entry q
      USING "user" u
      WHERE q.user_id = u.id
        AND u.status <> 'active'
    `);

    await tx.execute(sql`
      DELETE FROM cm_queue_entry q
      USING cm_preference p
      WHERE q.user_id = p.user_id
        AND p.allow_anon_queue = false
    `);

    await tx.execute(sql`
      DELETE FROM cm_queue_entry q
      USING cm_session_participant sp
      JOIN cm_session s ON s.id = sp.session_id
      WHERE q.user_id = sp.user_id
        AND s.status = 'active'
    `);

    const [lastRoundRow] = await tx
      .select({ value: adminSetting.value })
      .from(adminSetting)
      .where(eq(adminSetting.key, MATCH_ROUND_AT_KEY))
      .limit(1);

    const lastRoundAt =
      typeof lastRoundRow?.value === "string"
        ? parseDateLike(lastRoundRow.value)
        : null;

    if (!force && lastRoundAt) {
      const elapsed = now.getTime() - lastRoundAt.getTime();
      if (elapsed < MATCH_ROUND_INTERVAL_MS) {
        return { pairedCount: 0 };
      }
    }

    await tx
      .insert(adminSetting)
      .values({ key: MATCH_ROUND_AT_KEY, value: now.toISOString() })
      .onConflictDoUpdate({
        target: adminSetting.key,
        set: { value: now.toISOString() },
      });

    const candidateRows = await tx.execute<{
      queue_id: string;
      user_id: string;
      alias: string;
      scope: string;
      university: string | null;
      created_at: Date | string;
      heartbeat_at: Date | string;
    }>(sql`
      SELECT
        q.id AS queue_id,
        q.user_id,
        q.alias,
        q.scope,
        u.university,
        q.created_at,
        q.heartbeat_at
      FROM cm_queue_entry q
      JOIN "user" u ON u.id = q.user_id
      LEFT JOIN cm_preference p ON p.user_id = q.user_id
      WHERE q.heartbeat_at >= ${staleCutoff}
        AND u.status = 'active'
        AND COALESCE(p.allow_anon_queue, true) = true
      ORDER BY RANDOM()
    `);

    const candidates: QueueCandidate[] = candidateRows.rows
      .map((row) => ({
        queueId: row.queue_id,
        userId: row.user_id,
        alias: row.alias,
        scope: normalizeScope(row.scope),
        university: row.university,
        createdAt: parseDateLike(row.created_at) ?? now,
        heartbeatAt: parseDateLike(row.heartbeat_at) ?? now,
      }))
      .filter((row) => row.alias.length >= 3);

    if (candidates.length < 2) {
      return { pairedCount: 0 };
    }

    const candidateIds = candidates.map((c) => c.userId);
    const idsSql = sql.join(candidateIds.map((id) => sql`${id}`), sql`, `);

    const blockedRows = await tx.execute<{ blocker_id: string; blocked_id: string }>(sql`
      SELECT blocker_id, blocked_id
      FROM cm_block
      WHERE blocker_id IN (${idsSql})
        AND blocked_id IN (${idsSql})
    `);

    const blockedPairs = new Set<string>(
      blockedRows.rows.map((row) => pairKey(row.blocker_id, row.blocked_id)),
    );

    const cooldownRows = await tx
      .select({
        userIdLow: cmRematchCooldown.userIdLow,
        userIdHigh: cmRematchCooldown.userIdHigh,
      })
      .from(cmRematchCooldown)
      .where(
        and(
          gt(cmRematchCooldown.expiresAt, now),
          inArray(cmRematchCooldown.userIdLow, candidateIds),
          inArray(cmRematchCooldown.userIdHigh, candidateIds),
        ),
      );

    const cooldownPairs = new Set<string>(
      cooldownRows.map((row) => pairKey(row.userIdLow, row.userIdHigh)),
    );

    const dmRows = await tx.execute<{ user_id_low: string; user_id_high: string }>(sql`
      SELECT
        LEAST(cp1.user_id, cp2.user_id) AS user_id_low,
        GREATEST(cp1.user_id, cp2.user_id) AS user_id_high
      FROM conversation c
      JOIN conversation_participant cp1
        ON cp1.conversation_id = c.id
      JOIN conversation_participant cp2
        ON cp2.conversation_id = c.id
       AND cp2.user_id > cp1.user_id
      WHERE c.is_request = false
        AND c.deleted_at IS NULL
        AND cp1.user_id IN (${idsSql})
        AND cp2.user_id IN (${idsSql})
      GROUP BY 1, 2
    `);

    const dmPairs = new Set<string>(
      dmRows.rows.map((row) => pairKey(row.user_id_low, row.user_id_high)),
    );

    const pairs = findEligiblePairs(candidates, blockedPairs, dmPairs, cooldownPairs);

    const createSessionForPair = async (pair: [QueueCandidate, QueueCandidate]) => {
      const [first, second] = pair;

      const [sessionRow] = await tx
        .insert(cmSession)
        .values({
          status: "active",
          createdAt: now,
        })
        .returning({ id: cmSession.id });

      await tx.insert(cmSessionParticipant).values([
        {
          sessionId: sessionRow.id,
          userId: first.userId,
          alias: first.alias,
          connectRequested: false,
          createdAt: now,
        },
        {
          sessionId: sessionRow.id,
          userId: second.userId,
          alias: second.alias,
          connectRequested: false,
          createdAt: now,
        },
      ]);

      await tx
        .delete(cmQueueEntry)
        .where(inArray(cmQueueEntry.userId, [first.userId, second.userId]));
    };

    for (const pair of pairs) {
      await createSessionForPair(pair);
    }

    console.info("[campus-match] matching round completed", {
      force,
      candidates: candidates.length,
      paired: pairs.length,
    });

    return { pairedCount: pairs.length };
  });

  return result;
}

async function loadActiveSessionParticipants(
  sessionId: string,
): Promise<SessionParticipantRow[]> {
  return db
    .select({
      userId: cmSessionParticipant.userId,
      alias: cmSessionParticipant.alias,
      connectRequested: cmSessionParticipant.connectRequested,
    })
    .from(cmSessionParticipant)
    .where(eq(cmSessionParticipant.sessionId, sessionId));
}

// ─── getCampusMatchEnabledAction ─────────────────────────────────────────────

export async function getCampusMatchEnabledAction(): Promise<ActionResult<boolean>> {
  const enabled = await getCampusMatchEnabled();
  return { success: true, data: enabled };
}

// ─── getCampusMatchPreferences ───────────────────────────────────────────────

export async function getCampusMatchPreferences(): Promise<ActionResult<CampusMatchPreferences>> {
  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const preferences = await getCampusMatchPreferencesForUser(authSession.user.id);
  return { success: true, data: preferences };
}

// ─── updateCampusMatchPreferences ────────────────────────────────────────────

export async function updateCampusMatchPreferences(
  input: z.infer<typeof updatePreferenceSchema>,
): Promise<ActionResult<void>> {
  const parsed = updatePreferenceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const userId = authSession.user.id;
  const current = await getCampusMatchPreferencesForUser(userId);

  const nextAllowAnonQueue =
    parsed.data.allowAnonQueue === undefined
      ? current.allowAnonQueue
      : parsed.data.allowAnonQueue;
  const nextDefaultAlias =
    parsed.data.defaultAlias === undefined
      ? current.defaultAlias
      : parsed.data.defaultAlias;
  const nextLastScope =
    parsed.data.lastScope === undefined ? current.lastScope : parsed.data.lastScope;

  await db
    .insert(cmPreference)
    .values({
      userId,
      allowAnonQueue: nextAllowAnonQueue,
      defaultAlias: nextDefaultAlias,
      lastScope: nextLastScope,
    })
    .onConflictDoUpdate({
      target: cmPreference.userId,
      set: {
        allowAnonQueue: nextAllowAnonQueue,
        defaultAlias: nextDefaultAlias,
        lastScope: nextLastScope,
      },
    });

  if (!nextAllowAnonQueue) {
    await db.delete(cmQueueEntry).where(eq(cmQueueEntry.userId, userId));
  }

  return { success: true, data: undefined };
}

// ─── getCampusMatchState ─────────────────────────────────────────────────────

export async function getCampusMatchState(): Promise<ActionResult<CampusMatchState>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const userId = authSession.user.id;
  const now = new Date();

  const [preferences, queueRows, activeSessionRows, lastRoundAt] = await Promise.all([
    getCampusMatchPreferencesForUser(userId),
    db
      .select({
        scope: cmQueueEntry.scope,
        alias: cmQueueEntry.alias,
        createdAt: cmQueueEntry.createdAt,
        heartbeatAt: cmQueueEntry.heartbeatAt,
      })
      .from(cmQueueEntry)
      .where(eq(cmQueueEntry.userId, userId))
      .limit(1),
    db
      .select({
        sessionId: cmSession.id,
        sessionStatus: cmSession.status,
      })
      .from(cmSessionParticipant)
      .innerJoin(
        cmSession,
        and(
          eq(cmSession.id, cmSessionParticipant.sessionId),
          eq(cmSession.status, "active"),
        ),
      )
      .where(eq(cmSessionParticipant.userId, userId))
      .limit(1),
    getLastRoundAt(),
  ]);

  const activeSession = activeSessionRows[0] ?? null;

  if (activeSession) {
    await db.delete(cmQueueEntry).where(eq(cmQueueEntry.userId, userId));

    const participants = await loadActiveSessionParticipants(activeSession.sessionId);
    const mine = participants.find((p) => p.userId === userId);
    const partner = participants.find((p) => p.userId !== userId);

    if (!mine || !partner) {
      return { success: false, error: "Session participant data is invalid" };
    }

    const connectState: ConnectState =
      mine.connectRequested && partner.connectRequested
        ? "mutual"
        : mine.connectRequested
          ? "pending_me"
          : partner.connectRequested
            ? "pending_them"
            : "none";

    return {
      success: true,
      data: {
        status: "in_session",
        preferences,
        queue: null,
        session: {
          conversationId: activeSession.sessionId,
          sessionStatus: "active",
          myAlias: mine.alias,
          partnerAlias: partner.alias,
          connectState,
        },
      },
    };
  }

  let queue: (typeof queueRows)[number] | null = queueRows[0] ?? null;
  if (queue && now.getTime() - queue.heartbeatAt.getTime() > STALE_QUEUE_MS) {
    await db.delete(cmQueueEntry).where(eq(cmQueueEntry.userId, userId));
    queue = null;
  }

  if (!queue) {
    return {
      success: true,
      data: {
        status: "idle",
        preferences,
        queue: null,
        session: null,
      },
    };
  }

  const nextRoundAt = computeNextRoundAt(lastRoundAt, now);

  return {
    success: true,
    data: {
      status: "waiting",
      preferences,
      queue: {
        scope: normalizeScope(queue.scope),
        alias: queue.alias,
        waitingSince: queue.createdAt.toISOString(),
        nextRoundAt: nextRoundAt.toISOString(),
      },
      session: null,
    },
  };
}

// ─── joinCampusMatchQueue ────────────────────────────────────────────────────

export async function joinCampusMatchQueue(
  input: z.infer<typeof joinQueueSchema>,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = joinQueueSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const userId = authSession.user.id;
  const preferences = await getCampusMatchPreferencesForUser(userId);

  if (!preferences.allowAnonQueue) {
    return { success: false, error: "Campus Match is disabled in your privacy settings" };
  }

  const now = new Date();

  const joined = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`campus-match-user:${userId}`}))`);

    const activeSessionRows = await tx
      .select({ sessionId: cmSession.id })
      .from(cmSessionParticipant)
      .innerJoin(
        cmSession,
        and(
          eq(cmSession.id, cmSessionParticipant.sessionId),
          eq(cmSession.status, "active"),
        ),
      )
      .where(eq(cmSessionParticipant.userId, userId))
      .limit(1);

    if (activeSessionRows.length > 0) {
      return { error: "You already have an active Campus Match session" };
    }

    await tx
      .insert(cmQueueEntry)
      .values({
        userId,
        alias: parsed.data.alias,
        scope: parsed.data.scope,
        heartbeatAt: now,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: cmQueueEntry.userId,
        set: {
          alias: parsed.data.alias,
          scope: parsed.data.scope,
          heartbeatAt: now,
          createdAt: now,
        },
      });

    await tx
      .insert(cmPreference)
      .values({
        userId,
        allowAnonQueue: preferences.allowAnonQueue,
        defaultAlias: preferences.defaultAlias,
        lastScope: parsed.data.scope,
      })
      .onConflictDoUpdate({
        target: cmPreference.userId,
        set: {
          lastScope: parsed.data.scope,
        },
      });

    return { error: null as string | null };
  });

  if (joined.error) {
    return { success: false, error: joined.error };
  }

  void runCampusMatchRound(true).catch((error) => {
    console.error("[campus-match] failed to run immediate matching round", error);
  });

  console.info("[campus-match] queue joined", {
    userId,
    scope: parsed.data.scope,
  });

  return { success: true, data: undefined };
}

// ─── leaveCampusMatchQueue ───────────────────────────────────────────────────

export async function leaveCampusMatchQueue(): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const limited = await rateLimit("create");
  if (limited) return limited;

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  await db.delete(cmQueueEntry).where(eq(cmQueueEntry.userId, authSession.user.id));

  console.info("[campus-match] queue left", {
    userId: authSession.user.id,
  });

  return { success: true, data: undefined };
}

// ─── heartbeatCampusMatchQueue ───────────────────────────────────────────────

export async function heartbeatCampusMatchQueue(): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const limited = await rateLimit("general");
  if (limited) return limited;

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  await db
    .update(cmQueueEntry)
    .set({ heartbeatAt: new Date() })
    .where(eq(cmQueueEntry.userId, authSession.user.id));

  void runCampusMatchRound(false).catch((error) => {
    console.error("[campus-match] failed to run heartbeat matching round", error);
  });

  return { success: true, data: undefined };
}

// ─── skipCampusMatchSession ──────────────────────────────────────────────────

export async function skipCampusMatchSession(
  input: z.infer<typeof sessionInputSchema>,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = sessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const userId = authSession.user.id;
  const preferences = await getCampusMatchPreferencesForUser(userId);
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const locked = await closeActiveSession(tx, parsed.data.sessionId, "skipped", now);
    if (!locked.success) return locked;

    const me = locked.participants.find((p) => p.userId === userId);
    if (!me) return { success: false as const, error: "Not allowed to manage this session" };

    await tx
      .insert(cmQueueEntry)
      .values({
        userId,
        alias: me.alias,
        scope: preferences.lastScope,
        heartbeatAt: now,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: cmQueueEntry.userId,
        set: {
          alias: me.alias,
          scope: preferences.lastScope,
          heartbeatAt: now,
          createdAt: now,
        },
      });

    return { success: true as const };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  void runCampusMatchRound(true).catch((error) => {
    console.error("[campus-match] failed to run matching round after skip", error);
  });

  return { success: true, data: undefined };
}

// ─── endCampusMatchSession ───────────────────────────────────────────────────

export async function endCampusMatchSession(
  input: z.infer<typeof sessionInputSchema>,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = sessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const userId = authSession.user.id;
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const closed = await closeActiveSession(tx, parsed.data.sessionId, "ended", now);
    if (!closed.success) return closed;

    const me = closed.participants.find((p) => p.userId === userId);
    if (!me) return { success: false as const, error: "Not allowed to manage this session" };

    return { success: true as const };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, data: undefined };
}

// ─── requestCampusMatchConnect ───────────────────────────────────────────────

export async function requestCampusMatchConnect(
  input: z.infer<typeof sessionInputSchema>,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = sessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const userId = authSession.user.id;

  try {
    const result = await db.transaction(async (tx) => {
      const activeSessionRows = await tx
        .select({ id: cmSession.id })
        .from(cmSession)
        .where(
          and(
            eq(cmSession.id, parsed.data.sessionId),
            eq(cmSession.status, "active"),
          ),
        )
        .limit(1);

      if (activeSessionRows.length === 0) {
        return { error: "Session is no longer active" };
      }

      await tx.execute(
        sql`SELECT id FROM cm_session WHERE id = ${parsed.data.sessionId}::uuid AND status = 'active' FOR UPDATE`,
      );

      const participants = await tx
        .select({
          userId: cmSessionParticipant.userId,
          alias: cmSessionParticipant.alias,
          connectRequested: cmSessionParticipant.connectRequested,
        })
        .from(cmSessionParticipant)
        .where(eq(cmSessionParticipant.sessionId, parsed.data.sessionId));

      if (participants.length < 2) {
        return { error: "Session is no longer active" };
      }

      const me = participants.find((participant) => participant.userId === userId);
      if (!me) {
        return { error: "Not allowed to manage this session" };
      }

      await tx
        .update(cmSessionParticipant)
        .set({ connectRequested: true })
        .where(
          and(
            eq(cmSessionParticipant.sessionId, parsed.data.sessionId),
            eq(cmSessionParticipant.userId, userId),
          ),
        );

      const updated = await tx
        .select({
          userId: cmSessionParticipant.userId,
          alias: cmSessionParticipant.alias,
          connectRequested: cmSessionParticipant.connectRequested,
        })
        .from(cmSessionParticipant)
        .where(eq(cmSessionParticipant.sessionId, parsed.data.sessionId));

      const everyoneRequested =
        updated.length >= 2 && updated.every((participant) => participant.connectRequested);

      if (everyoneRequested) {
        await promoteSessionToConversation(tx, parsed.data.sessionId, updated);
      }

      return { error: null as string | null };
    });

    if (result.error) {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error("[campus-match] promotion failed", {
      sessionId: parsed.data.sessionId,
      error,
    });
    return {
      success: false,
      error: "Unable to promote this session right now. Please try again.",
    };
  }

  return { success: true, data: undefined };
}

// ─── declineCampusMatchConnect ───────────────────────────────────────────────

export async function declineCampusMatchConnect(
  input: z.infer<typeof sessionInputSchema>,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = sessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const userId = authSession.user.id;

  const result = await db.transaction(async (tx) => {
    const activeSessionRows = await tx
      .select({ id: cmSession.id })
      .from(cmSession)
      .where(
        and(
          eq(cmSession.id, parsed.data.sessionId),
          eq(cmSession.status, "active"),
        ),
      )
      .limit(1);

    if (activeSessionRows.length === 0) {
      return { error: "Session is no longer active" };
    }

    await tx.execute(
      sql`SELECT id FROM cm_session WHERE id = ${parsed.data.sessionId}::uuid AND status = 'active' FOR UPDATE`,
    );

    const participants = await tx
      .select({ userId: cmSessionParticipant.userId })
      .from(cmSessionParticipant)
      .where(eq(cmSessionParticipant.sessionId, parsed.data.sessionId));

    if (participants.length < 2) {
      return { error: "Session is no longer active" };
    }

    if (!participants.some((participant) => participant.userId === userId)) {
      return { error: "Not allowed to manage this session" };
    }

    await tx
      .update(cmSessionParticipant)
      .set({ connectRequested: false })
      .where(eq(cmSessionParticipant.sessionId, parsed.data.sessionId));

    return { error: null as string | null };
  });

  if (result.error) {
    return { success: false, error: result.error };
  }

  return { success: true, data: undefined };
}

// ─── reportCampusMatchUser ───────────────────────────────────────────────────

export async function reportCampusMatchUser(
  input: z.infer<typeof reportUserSchema>,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = reportUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const userId = authSession.user.id;
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const closed = await closeActiveSession(tx, parsed.data.sessionId, "reported", now);
    if (!closed.success) return closed;

    const me = closed.participants.find((p) => p.userId === userId);
    const partner = closed.participants.find((p) => p.userId !== userId);

    if (!me || !partner) {
      return { success: false as const, error: "Not allowed to manage this session" };
    }

    await tx
      .insert(cmReport)
      .values({
        sessionId: parsed.data.sessionId,
        reporterId: userId,
        reportedUserId: partner.userId,
        reason: parsed.data.reason,
        status: "pending",
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [cmReport.sessionId, cmReport.reporterId],
        set: {
          reason: parsed.data.reason,
          status: "pending",
          createdAt: now,
        },
      });

    await tx
      .insert(cmBlock)
      .values({
        blockerId: userId,
        blockedId: partner.userId,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [cmBlock.blockerId, cmBlock.blockedId],
      });

    console.info("[campus-match] report created", {
      sessionId: parsed.data.sessionId,
      reporterId: userId,
      reportedUserId: partner.userId,
    });

    return { success: true as const };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, data: undefined };
}

// ─── blockCampusMatchUser ────────────────────────────────────────────────────

export async function blockCampusMatchUser(
  input: z.infer<typeof sessionInputSchema>,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = sessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const userId = authSession.user.id;
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const closed = await closeActiveSession(tx, parsed.data.sessionId, "blocked", now);
    if (!closed.success) return closed;

    const me = closed.participants.find((p) => p.userId === userId);
    const partner = closed.participants.find((p) => p.userId !== userId);

    if (!me || !partner) {
      return { success: false as const, error: "Not allowed to manage this session" };
    }

    await tx
      .insert(cmBlock)
      .values({
        blockerId: userId,
        blockedId: partner.userId,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [cmBlock.blockerId, cmBlock.blockedId],
      });

    console.info("[campus-match] user blocked", {
      sessionId: parsed.data.sessionId,
      blockerId: userId,
      blockedUserId: partner.userId,
    });

    return { success: true as const };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, data: undefined };
}

// ─── sendCampusMatchMessage ──────────────────────────────────────────────────

export async function sendCampusMatchMessage(
  input: z.infer<typeof sendMessageSchema>,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const userId = authSession.user.id;
  const body = parsed.data.body?.trim() || null;
  const imageUrl = parsed.data.imageUrl?.trim() || null;

  const result = await db.transaction(async (tx) => {
    const activeSessionRows = await tx
      .select({ id: cmSession.id })
      .from(cmSession)
      .where(
        and(
          eq(cmSession.id, parsed.data.sessionId),
          eq(cmSession.status, "active"),
        ),
      )
      .limit(1);

    if (activeSessionRows.length === 0) {
      return { error: "Session is no longer active" };
    }

    await tx.execute(
      sql`SELECT id FROM cm_session WHERE id = ${parsed.data.sessionId}::uuid AND status = 'active' FOR UPDATE`,
    );

    const participants = await tx
      .select({ userId: cmSessionParticipant.userId })
      .from(cmSessionParticipant)
      .where(eq(cmSessionParticipant.sessionId, parsed.data.sessionId));

    if (participants.length < 2) {
      return { error: "Session is no longer active" };
    }

    if (!participants.some((participant) => participant.userId === userId)) {
      return { error: "Not allowed to manage this session" };
    }

    await tx.insert(cmMessage).values({
      sessionId: parsed.data.sessionId,
      senderId: userId,
      body,
      imageUrl,
    });

    return { error: null as string | null };
  });

  if (result.error) {
    return { success: false, error: result.error };
  }

  return { success: true, data: undefined };
}

// ─── Compatibility wrappers ──────────────────────────────────────────────────

export async function getCampusMatchPreference(): Promise<ActionResult<CampusMatchPreferences>> {
  return getCampusMatchPreferences();
}

export async function updateCampusMatchPreference(
  input: z.infer<typeof updatePreferenceSchema>,
): Promise<ActionResult<void>> {
  return updateCampusMatchPreferences(input);
}

export async function joinQueue(
  input: z.infer<typeof joinQueueSchema>,
): Promise<ActionResult<void>> {
  return joinCampusMatchQueue(input);
}

export async function leaveQueue(): Promise<ActionResult<void>> {
  return leaveCampusMatchQueue();
}

export async function getQueueStatus(): Promise<ActionResult<LegacyQueuePresence>> {
  const state = await getCampusMatchState();
  if (!state.success) return state;

  return {
    success: true,
    data: {
      inQueue: state.data.status === "waiting",
      inSession: state.data.status === "in_session",
    },
  };
}

export async function heartbeat(): Promise<ActionResult<void>> {
  return heartbeatCampusMatchQueue();
}

export async function skipSession(sessionId: string): Promise<ActionResult<void>> {
  return skipCampusMatchSession({ sessionId });
}

export async function endSession(sessionId: string): Promise<ActionResult<void>> {
  return endCampusMatchSession({ sessionId });
}

export async function requestConnect(sessionId: string): Promise<ActionResult<void>> {
  return requestCampusMatchConnect({ sessionId });
}

export async function declineConnect(sessionId: string): Promise<ActionResult<void>> {
  return declineCampusMatchConnect({ sessionId });
}

export async function reportUser(
  input: z.infer<typeof reportUserSchema>,
): Promise<ActionResult<void>> {
  return reportCampusMatchUser(input);
}

export async function blockUser(sessionId: string): Promise<ActionResult<void>> {
  return blockCampusMatchUser({ sessionId });
}

export async function sendAnonMessage(
  input: z.infer<typeof sendMessageSchema>,
): Promise<ActionResult<void>> {
  return sendCampusMatchMessage(input);
}

// ─── shared block helper for this module users ───────────────────────────────

export async function assertCampusMatchInteractionAllowed(
  actorUserId: string,
  targetUserId: string,
): Promise<ActionResult<void> | null> {
  const blocked = await isGloballyBlocked(actorUserId, targetUserId);
  if (!blocked) return null;
  return { success: false, error: CAMPUS_MATCH_INTERACTION_BLOCKED_ERROR };
}
