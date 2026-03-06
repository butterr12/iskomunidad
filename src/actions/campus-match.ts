"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
  cmBan,
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
  message,
  user,
  userFollow,
} from "@/lib/schema";
import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  type ActionResult,
  createNotification,
  getCampusMatchEnabled,
  getSession,
  guardAction,
  rateLimit,
  requireCampusMatch,
} from "./_helpers";
import { getIO } from "@/lib/socket-server";

// ─── Constants ───────────────────────────────────────────────────────────────

const STALE_QUEUE_MS = 90_000;
const REMATCH_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const IMMEDIATE_QUEUE_LOCK_KEY = "campus-match-immediate-v2";
const CAMPUS_MATCH_INTERACTION_BLOCKED_ERROR = "You cannot interact with this user";
const PAGE_SIZE = 30;

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

const getMessagesSchema = z.object({
  sessionId: sessionIdSchema,
  cursor: z.string().datetime().optional(),
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
export type AnonSessionStatus = "active" | "ended" | "promoted";
export type ConnectState = "none" | "pending_me" | "pending_them" | "mutual";

export type CampusMatchPreferences = {
  allowAnonQueue: boolean;
  defaultAlias: string | null;
  lastScope: MatchScope;
};

export type CampusMatchMessageData = {
  id: string;
  sessionId: string;
  senderId: string | null;
  senderAlias: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
};

export type CampusMatchRuntimeState = {
  status: "idle" | "waiting" | "in_session" | "banned";
  preferences: CampusMatchPreferences;
  queue: null | {
    scope: MatchScope;
    alias: string;
    waitingSince: string;
  };
  session: null | {
    conversationId: string;
    sessionStatus: AnonSessionStatus;
    myAlias: string;
    partnerAlias: string;
    connectState: ConnectState;
  };
  ban: null | {
    expiresAt: string;
    reason: string | null;
  };
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

type ActiveBan = {
  id: string;
  expiresAt: Date;
  reason: string | null;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type LockedSession = {
  sessionId: string;
  participants: SessionParticipantRow[];
  me: SessionParticipantRow;
  partner: SessionParticipantRow;
};

type ImmediateQueuePassResult = {
  pairedCount: number;
  matches: Array<{ sessionId: string; userIds: string[] }>;
  removedUserIds: string[];
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

function formatBanMessage(ban: ActiveBan): string {
  const until = ban.expiresAt.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  });
  return `Campus Match is temporarily unavailable for your account until ${until} UTC`;
}

async function getActiveBanForUser(userId: string): Promise<ActiveBan | null> {
  const rows = await db
    .select({
      id: cmBan.id,
      expiresAt: cmBan.expiresAt,
      reason: cmBan.reason,
    })
    .from(cmBan)
    .where(
      and(
        eq(cmBan.userId, userId),
        isNull(cmBan.liftedAt),
        gt(cmBan.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(cmBan.expiresAt))
    .limit(1);

  return rows[0] ?? null;
}

async function getActiveBanForUserTx(tx: Tx, userId: string): Promise<ActiveBan | null> {
  const rows = await tx
    .select({
      id: cmBan.id,
      expiresAt: cmBan.expiresAt,
      reason: cmBan.reason,
    })
    .from(cmBan)
    .where(
      and(
        eq(cmBan.userId, userId),
        isNull(cmBan.liftedAt),
        gt(cmBan.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(cmBan.expiresAt))
    .limit(1);

  return rows[0] ?? null;
}

async function ensureUserNotBanned(userId: string): Promise<ActionResult<never> | null> {
  const ban = await getActiveBanForUser(userId);
  if (!ban) return null;

  await db.delete(cmQueueEntry).where(eq(cmQueueEntry.userId, userId));
  return { success: false, error: formatBanMessage(ban) };
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

async function applyRematchCooldown(
  participantUserIds: string[],
  now: Date,
  tx: Tx,
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

function emitCampusMatchUserEvent(
  eventName:
    | "campus_match_state_changed"
    | "campus_match_found"
    | "campus_match_session_ended"
    | "campus_match_connect_changed"
    | "campus_match_promoted"
    | "campus_match_message",
  payload: Record<string, unknown>,
  userIds: string[],
): void {
  try {
    const io = getIO();
    const uniq = [...new Set(userIds)];
    for (const userId of uniq) {
      io.to(`user:${userId}`).emit(eventName, payload);
    }
  } catch (err) {
    console.error("[campus-match] socket emit failed", { eventName, err });
  }
}

function emitCampusMatchStateChanged(userIds: string[]): void {
  emitCampusMatchUserEvent(
    "campus_match_state_changed",
    { changedAt: new Date().toISOString() },
    userIds,
  );
}

function logUnauthorizedSessionAction(action: string, userId: string, sessionId: string): void {
  console.warn("[campus-match] unauthorized session action", {
    action,
    userId,
    sessionId,
  });
}

async function lockActiveSessionForParticipant(
  tx: Tx,
  sessionId: string,
  userId: string,
  action: string,
): Promise<{ success: true; data: LockedSession } | { success: false; error: string }> {
  const lockedRows = await tx.execute<{ id: string }>(
    sql`SELECT id FROM cm_session WHERE id = ${sessionId}::uuid AND status = 'active' FOR UPDATE`,
  );

  if (lockedRows.rows.length === 0) {
    return { success: false, error: "Session is no longer active" };
  }

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

  const me = participants.find((participant) => participant.userId === userId);
  if (!me) {
    logUnauthorizedSessionAction(action, userId, sessionId);
    return { success: false, error: "Not allowed to manage this session" };
  }

  const partner = participants.find((participant) => participant.userId !== userId);
  if (!partner) {
    return { success: false, error: "Session participant data is invalid" };
  }

  return {
    success: true,
    data: {
      sessionId,
      participants,
      me,
      partner,
    },
  };
}

async function verifyActiveSessionParticipant(
  sessionId: string,
  userId: string,
  action: string,
): Promise<{ success: true; data: LockedSession } | { success: false; error: string }> {
  const rows = await db
    .select({ id: cmSession.id })
    .from(cmSession)
    .where(and(eq(cmSession.id, sessionId), eq(cmSession.status, "active")))
    .limit(1);

  if (rows.length === 0) {
    return { success: false, error: "Session is no longer active" };
  }

  const participants = await db
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

  const me = participants.find((participant) => participant.userId === userId);
  if (!me) {
    logUnauthorizedSessionAction(action, userId, sessionId);
    return { success: false, error: "Not allowed to manage this session" };
  }

  const partner = participants.find((participant) => participant.userId !== userId);
  if (!partner) {
    return { success: false, error: "Session participant data is invalid" };
  }

  return {
    success: true,
    data: {
      sessionId,
      participants,
      me,
      partner,
    },
  };
}

async function closeActiveSession(
  tx: Tx,
  locked: LockedSession,
  endedReason: string,
  now: Date,
): Promise<void> {
  await tx
    .update(cmSession)
    .set({
      status: "ended",
      endedReason,
      endedAt: now,
    })
    .where(eq(cmSession.id, locked.sessionId));

  await tx
    .update(cmSessionParticipant)
    .set({ connectRequested: false })
    .where(eq(cmSessionParticipant.sessionId, locked.sessionId));

  await tx
    .delete(cmQueueEntry)
    .where(inArray(cmQueueEntry.userId, locked.participants.map((p) => p.userId)));

  await applyRematchCooldown(
    locked.participants.map((p) => p.userId),
    now,
    tx,
  );
}

async function promoteSessionToConversation(
  tx: Tx,
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

  const existingConversationMessages = await tx
    .select({ id: message.id })
    .from(message)
    .where(eq(message.conversationId, sessionId))
    .limit(1);

  if (existingConversationMessages.length === 0) {
    await tx.execute(sql`
      INSERT INTO message (conversation_id, sender_id, body, image_url, created_at)
      SELECT ${sessionId}::uuid, sender_id, body, image_url, created_at
      FROM cm_message
      WHERE session_id = ${sessionId}::uuid
      ORDER BY created_at ASC
    `);
  }

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

export async function runImmediateQueuePass(): Promise<ImmediateQueuePassResult> {
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const lockResult = await tx.execute<{ locked: boolean | string }>(
      sql`SELECT pg_try_advisory_xact_lock(hashtext(${IMMEDIATE_QUEUE_LOCK_KEY})) AS locked`,
    );
    const lockAcquired = parseBoolean(lockResult.rows[0]?.locked);

    if (!lockAcquired) {
      console.info("[campus-match] immediate pass skipped", {
        reason: "lock_busy",
      });
      return { pairedCount: 0, matches: [], removedUserIds: [] };
    }

    const staleCutoff = new Date(now.getTime() - STALE_QUEUE_MS);
    const removedUserIds = new Set<string>();

    const staleRemoved = await tx
      .delete(cmQueueEntry)
      .where(sql`${cmQueueEntry.heartbeatAt} < ${staleCutoff}`)
      .returning({ userId: cmQueueEntry.userId });
    for (const r of staleRemoved) removedUserIds.add(r.userId);

    const inactiveRemoved = await tx.execute<{ user_id: string }>(sql`
      DELETE FROM cm_queue_entry q
      USING "user" u
      WHERE q.user_id = u.id
        AND u.status <> 'active'
      RETURNING q.user_id
    `);
    for (const r of inactiveRemoved.rows) removedUserIds.add(r.user_id);

    const optOutRemoved = await tx.execute<{ user_id: string }>(sql`
      DELETE FROM cm_queue_entry q
      USING cm_preference p
      WHERE q.user_id = p.user_id
        AND p.allow_anon_queue = false
      RETURNING q.user_id
    `);
    for (const r of optOutRemoved.rows) removedUserIds.add(r.user_id);

    const activeSessionRemoved = await tx.execute<{ user_id: string }>(sql`
      DELETE FROM cm_queue_entry q
      USING cm_session_participant sp
      JOIN cm_session s ON s.id = sp.session_id
      WHERE q.user_id = sp.user_id
        AND s.status = 'active'
      RETURNING q.user_id
    `);
    for (const r of activeSessionRemoved.rows) removedUserIds.add(r.user_id);

    const bannedRemoved = await tx.execute<{ user_id: string }>(sql`
      DELETE FROM cm_queue_entry q
      USING cm_ban b
      WHERE q.user_id = b.user_id
        AND b.lifted_at IS NULL
        AND b.expires_at > ${now}
      RETURNING q.user_id
    `);
    for (const r of bannedRemoved.rows) removedUserIds.add(r.user_id);

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
      LEFT JOIN cm_ban b
        ON b.user_id = q.user_id
       AND b.lifted_at IS NULL
       AND b.expires_at > ${now}
      WHERE q.heartbeat_at >= ${staleCutoff}
        AND u.status = 'active'
        AND COALESCE(p.allow_anon_queue, true) = true
        AND b.id IS NULL
      ORDER BY q.created_at ASC, q.id ASC
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
      return { pairedCount: 0, matches: [], removedUserIds: [...removedUserIds] };
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
    const matches: Array<{ sessionId: string; userIds: string[] }> = [];

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

      matches.push({
        sessionId: sessionRow.id,
        userIds: [first.userId, second.userId],
      });
    };

    for (const pair of pairs) {
      await createSessionForPair(pair);
    }

    console.info("[campus-match] immediate pass completed", {
      candidates: candidates.length,
      paired: pairs.length,
    });

    return { pairedCount: pairs.length, matches, removedUserIds: [...removedUserIds] };
  });

  // Notify users removed during cleanup so their UI updates immediately
  if (result.removedUserIds.length > 0) {
    emitCampusMatchStateChanged(result.removedUserIds);
  }

  if (result.matches.length > 0) {
    for (const match of result.matches) {
      emitCampusMatchUserEvent(
        "campus_match_found",
        {
          sessionId: match.sessionId,
          conversationId: match.sessionId,
          matchedAt: new Date().toISOString(),
        },
        match.userIds,
      );
      emitCampusMatchStateChanged(match.userIds);
    }
  }

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

async function loadParticipantsForSession(
  tx: Tx,
  sessionId: string,
): Promise<SessionParticipantRow[]> {
  return tx
    .select({
      userId: cmSessionParticipant.userId,
      alias: cmSessionParticipant.alias,
      connectRequested: cmSessionParticipant.connectRequested,
    })
    .from(cmSessionParticipant)
    .where(eq(cmSessionParticipant.sessionId, sessionId));
}

function buildConnectState(
  mine: SessionParticipantRow,
  partner: SessionParticipantRow,
): ConnectState {
  if (mine.connectRequested && partner.connectRequested) return "mutual";
  if (mine.connectRequested) return "pending_me";
  if (partner.connectRequested) return "pending_them";
  return "none";
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

  emitCampusMatchStateChanged([userId]);
  return { success: true, data: undefined };
}

// ─── getCampusMatchRuntimeState ──────────────────────────────────────────────

export async function getCampusMatchRuntimeState(): Promise<ActionResult<CampusMatchRuntimeState>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const userId = authSession.user.id;
  const now = new Date();

  const [preferences, activeBan, queueRows, activeSessionRows] = await Promise.all([
    getCampusMatchPreferencesForUser(userId),
    getActiveBanForUser(userId),
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
  ]);

  if (activeBan) {
    await db.delete(cmQueueEntry).where(eq(cmQueueEntry.userId, userId));
    return {
      success: true,
      data: {
        status: "banned",
        preferences,
        queue: null,
        session: null,
        ban: {
          expiresAt: activeBan.expiresAt.toISOString(),
          reason: activeBan.reason,
        },
      },
    };
  }

  const activeSession = activeSessionRows[0] ?? null;

  if (activeSession) {
    await db.delete(cmQueueEntry).where(eq(cmQueueEntry.userId, userId));

    const participants = await loadActiveSessionParticipants(activeSession.sessionId);
    const mine = participants.find((p) => p.userId === userId);
    const partner = participants.find((p) => p.userId !== userId);

    if (!mine || !partner) {
      return { success: false, error: "Session participant data is invalid" };
    }

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
          connectState: buildConnectState(mine, partner),
        },
        ban: null,
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
        ban: null,
      },
    };
  }

  return {
    success: true,
    data: {
      status: "waiting",
      preferences,
      queue: {
        scope: normalizeScope(queue.scope),
        alias: queue.alias,
        waitingSince: queue.createdAt.toISOString(),
      },
      session: null,
      ban: null,
    },
  };
}

// ─── enqueueCampusMatch ──────────────────────────────────────────────────────

export async function enqueueCampusMatch(
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

  const abused = await guardAction("campus-match.join", { userId });
  if (abused) return abused;

  const banBlocked = await ensureUserNotBanned(userId);
  if (banBlocked) return banBlocked;

  const preferences = await getCampusMatchPreferencesForUser(userId);

  if (!preferences.allowAnonQueue) {
    return { success: false, error: "Campus Match is disabled in your privacy settings" };
  }

  const account = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { university: true },
  });
  if (parsed.data.scope === "same-campus" && !normalizeCampus(account?.university)) {
    return {
      success: false,
      error: "Set your university in Settings to use Same campus, or choose All campuses.",
    };
  }

  const now = new Date();

  const joined = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`campus-match-user:${userId}`}))`);

    const activeBan = await getActiveBanForUserTx(tx, userId);
    if (activeBan) {
      await tx.delete(cmQueueEntry).where(eq(cmQueueEntry.userId, userId));
      return { error: formatBanMessage(activeBan) };
    }

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
        },
      });

    await tx
      .insert(cmPreference)
      .values({
        userId,
        allowAnonQueue: preferences.allowAnonQueue,
        defaultAlias: parsed.data.alias,
        lastScope: parsed.data.scope,
      })
      .onConflictDoUpdate({
        target: cmPreference.userId,
        set: {
          defaultAlias: parsed.data.alias,
          lastScope: parsed.data.scope,
        },
      });

    return { error: null as string | null };
  });

  if (joined.error) {
    return { success: false, error: joined.error };
  }

  void runImmediateQueuePass().catch((error) => {
    console.error("[campus-match] failed to run immediate queue pass after enqueue", error);
  });

  emitCampusMatchStateChanged([userId]);

  console.info("[campus-match] queue joined", {
    userId,
    scope: parsed.data.scope,
  });

  return { success: true, data: undefined };
}

// ─── dequeueCampusMatch ──────────────────────────────────────────────────────

export async function dequeueCampusMatch(): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const limited = await rateLimit("create");
  if (limited) return limited;

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  await db.delete(cmQueueEntry).where(eq(cmQueueEntry.userId, authSession.user.id));
  emitCampusMatchStateChanged([authSession.user.id]);

  console.info("[campus-match] queue left", {
    userId: authSession.user.id,
  });

  return { success: true, data: undefined };
}

// ─── touchCampusMatchPresence ────────────────────────────────────────────────

export async function touchCampusMatchPresence(): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const userId = authSession.user.id;
  const banBlocked = await ensureUserNotBanned(userId);
  if (banBlocked) return banBlocked;

  const touched = await db
    .update(cmQueueEntry)
    .set({ heartbeatAt: new Date() })
    .where(eq(cmQueueEntry.userId, userId))
    .returning({ userId: cmQueueEntry.userId });

  if (touched.length === 0) {
    return { success: false, error: "Queue entry not found" };
  }

  return { success: true, data: undefined };
}

// ─── getCampusMatchMessages ──────────────────────────────────────────────────

export async function getCampusMatchMessages(
  input: z.infer<typeof getMessagesSchema>,
): Promise<ActionResult<{ messages: CampusMatchMessageData[]; nextCursor: string | null }>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;

  const limited = await rateLimit("general");
  if (limited) return limited;

  const parsed = getMessagesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const userId = authSession.user.id;
  const cursorDate = parsed.data.cursor ? new Date(parsed.data.cursor) : null;

  const verified = await verifyActiveSessionParticipant(
    parsed.data.sessionId,
    userId,
    "get_messages",
  );
  if (!verified.success) {
    return { success: false, error: verified.error };
  }

  const conditions = [eq(cmMessage.sessionId, parsed.data.sessionId)];
  if (cursorDate) {
    conditions.push(lt(cmMessage.createdAt, cursorDate));
  }

  const rows = await db
    .select({
      id: cmMessage.id,
      sessionId: cmMessage.sessionId,
      senderId: cmMessage.senderId,
      body: cmMessage.body,
      imageUrl: cmMessage.imageUrl,
      createdAt: cmMessage.createdAt,
    })
    .from(cmMessage)
    .where(and(...conditions))
    .orderBy(desc(cmMessage.createdAt))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const aliasByUserId = new Map(
    verified.data.participants.map((participant) => [participant.userId, participant.alias]),
  );

  // Compute nextCursor BEFORE .reverse() mutates pageRows in-place
  const nextCursor = hasMore
    ? pageRows[pageRows.length - 1].createdAt.toISOString()
    : null;

  const messages = pageRows
    .reverse()
    .map((row): CampusMatchMessageData => ({
      id: row.id,
      sessionId: row.sessionId,
      senderId: row.senderId,
      senderAlias: row.senderId ? aliasByUserId.get(row.senderId) ?? "Unknown" : "Unknown",
      body: row.body,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt.toISOString(),
    }));

  return {
    success: true,
    data: { messages, nextCursor },
  };
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
  const banBlocked = await ensureUserNotBanned(userId);
  if (banBlocked) return banBlocked;

  const preferences = await getCampusMatchPreferencesForUser(userId);
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const locked = await lockActiveSessionForParticipant(
      tx,
      parsed.data.sessionId,
      userId,
      "skip_session",
    );
    if (!locked.success) return { error: locked.error, userIds: [] as string[] };

    await closeActiveSession(tx, locked.data, "skipped", now);

    await tx
      .insert(cmQueueEntry)
      .values({
        userId,
        alias: locked.data.me.alias,
        scope: preferences.lastScope,
        heartbeatAt: now,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: cmQueueEntry.userId,
        set: {
          alias: locked.data.me.alias,
          scope: preferences.lastScope,
          heartbeatAt: now,
          createdAt: now,
        },
      });

    return {
      error: null as string | null,
      userIds: locked.data.participants.map((p) => p.userId),
    };
  });

  if (result.error) {
    return { success: false, error: result.error };
  }

  emitCampusMatchUserEvent(
    "campus_match_session_ended",
    {
      sessionId: parsed.data.sessionId,
      reason: "skipped",
      endedAt: now.toISOString(),
    },
    result.userIds,
  );
  emitCampusMatchStateChanged(result.userIds);

  void runImmediateQueuePass().catch((error) => {
    console.error("[campus-match] failed to run immediate queue pass after skip", error);
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
  const banBlocked = await ensureUserNotBanned(userId);
  if (banBlocked) return banBlocked;

  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const locked = await lockActiveSessionForParticipant(
      tx,
      parsed.data.sessionId,
      userId,
      "end_session",
    );
    if (!locked.success) return { error: locked.error, userIds: [] as string[] };

    await closeActiveSession(tx, locked.data, "ended", now);

    return {
      error: null as string | null,
      userIds: locked.data.participants.map((p) => p.userId),
    };
  });

  if (result.error) {
    return { success: false, error: result.error };
  }

  emitCampusMatchUserEvent(
    "campus_match_session_ended",
    {
      sessionId: parsed.data.sessionId,
      reason: "ended",
      endedAt: now.toISOString(),
    },
    result.userIds,
  );
  emitCampusMatchStateChanged(result.userIds);

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
  const banBlocked = await ensureUserNotBanned(userId);
  if (banBlocked) return banBlocked;

  try {
    const result = await db.transaction(async (tx) => {
      const locked = await lockActiveSessionForParticipant(
        tx,
        parsed.data.sessionId,
        userId,
        "request_connect",
      );
      if (!locked.success) {
        if (locked.error === "Session is no longer active") {
          const [sessionRow] = await tx
            .select({ status: cmSession.status })
            .from(cmSession)
            .where(eq(cmSession.id, parsed.data.sessionId))
            .limit(1);

          if (sessionRow?.status === "promoted") {
            const participants = await loadParticipantsForSession(tx, parsed.data.sessionId);
            const isParticipant = participants.some((participant) => participant.userId === userId);
            if (isParticipant) {
              return {
                error: null as string | null,
                userIds: participants.map((participant) => participant.userId),
                promoted: true,
                promotedNow: false,
              };
            }
          }
        }

        return { error: locked.error, userIds: [] as string[], promoted: false, promotedNow: false };
      }

      const blockCheck = await assertCampusMatchInteractionAllowed(userId, locked.data.partner.userId);
      if (blockCheck && !blockCheck.success) {
        return { error: blockCheck.error, userIds: [] as string[], promoted: false, promotedNow: false };
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

      const updated = await loadParticipantsForSession(tx, parsed.data.sessionId);
      const everyoneRequested =
        updated.length >= 2 && updated.every((participant) => participant.connectRequested);

      if (everyoneRequested) {
        await promoteSessionToConversation(tx, parsed.data.sessionId, updated);
      }

      return {
        error: null as string | null,
        promoted: everyoneRequested,
        promotedNow: everyoneRequested,
        userIds: updated.map((participant) => participant.userId),
      };
    });

    if (result.error) {
      return { success: false, error: result.error };
    }

    if (result.promotedNow) {
      emitCampusMatchUserEvent(
        "campus_match_promoted",
        {
          sessionId: parsed.data.sessionId,
          conversationId: parsed.data.sessionId,
          promotedAt: new Date().toISOString(),
        },
        result.userIds,
      );
    } else if (!result.promoted) {
      emitCampusMatchUserEvent(
        "campus_match_connect_changed",
        {
          sessionId: parsed.data.sessionId,
          changedAt: new Date().toISOString(),
        },
        result.userIds,
      );
    }

    emitCampusMatchStateChanged(result.userIds);
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
  const banBlocked = await ensureUserNotBanned(userId);
  if (banBlocked) return banBlocked;

  const result = await db.transaction(async (tx) => {
    const locked = await lockActiveSessionForParticipant(
      tx,
      parsed.data.sessionId,
      userId,
      "decline_connect",
    );
    if (!locked.success) return { error: locked.error, userIds: [] as string[] };

    // Locked decision: clear both users' connect requests.
    await tx
      .update(cmSessionParticipant)
      .set({ connectRequested: false })
      .where(eq(cmSessionParticipant.sessionId, parsed.data.sessionId));

    return {
      error: null as string | null,
      userIds: locked.data.participants.map((p) => p.userId),
    };
  });

  if (result.error) {
    return { success: false, error: result.error };
  }

  emitCampusMatchUserEvent(
    "campus_match_connect_changed",
    {
      sessionId: parsed.data.sessionId,
      changedAt: new Date().toISOString(),
    },
    result.userIds,
  );
  emitCampusMatchStateChanged(result.userIds);

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

  const abused = await guardAction("campus-match.report", { userId, contentBody: parsed.data.reason });
  if (abused) return abused;

  const banBlocked = await ensureUserNotBanned(userId);
  if (banBlocked) return banBlocked;

  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const locked = await lockActiveSessionForParticipant(
      tx,
      parsed.data.sessionId,
      userId,
      "report_user",
    );
    if (!locked.success) return { success: false as const, error: locked.error, userIds: [] as string[] };

    await closeActiveSession(tx, locked.data, "reported", now);

    await tx
      .insert(cmReport)
      .values({
        sessionId: parsed.data.sessionId,
        reporterId: userId,
        reportedUserId: locked.data.partner.userId,
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
        blockedId: locked.data.partner.userId,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [cmBlock.blockerId, cmBlock.blockedId],
      });

    console.info("[campus-match] report created", {
      sessionId: parsed.data.sessionId,
      reporterId: userId,
      reportedUserId: locked.data.partner.userId,
    });

    return {
      success: true as const,
      userIds: locked.data.participants.map((p) => p.userId),
    };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  emitCampusMatchUserEvent(
    "campus_match_session_ended",
    {
      sessionId: parsed.data.sessionId,
      reason: "reported",
      endedAt: now.toISOString(),
    },
    result.userIds,
  );
  emitCampusMatchStateChanged(result.userIds);

  await createNotification({
    type: "cm_report",
    targetId: parsed.data.sessionId,
    targetTitle: "Campus Match report",
    authorHandle: authSession.user.username ?? authSession.user.email,
    reason: parsed.data.reason,
  });

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
  const abused = await guardAction("campus-match.block", { userId });
  if (abused) return abused;

  const banBlocked = await ensureUserNotBanned(userId);
  if (banBlocked) return banBlocked;

  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const locked = await lockActiveSessionForParticipant(
      tx,
      parsed.data.sessionId,
      userId,
      "block_user",
    );
    if (!locked.success) return { success: false as const, error: locked.error, userIds: [] as string[] };

    await closeActiveSession(tx, locked.data, "blocked", now);

    await tx
      .insert(cmBlock)
      .values({
        blockerId: userId,
        blockedId: locked.data.partner.userId,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [cmBlock.blockerId, cmBlock.blockedId],
      });

    console.info("[campus-match] user blocked", {
      sessionId: parsed.data.sessionId,
      blockerId: userId,
      blockedUserId: locked.data.partner.userId,
    });

    return {
      success: true as const,
      userIds: locked.data.participants.map((p) => p.userId),
    };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  emitCampusMatchUserEvent(
    "campus_match_session_ended",
    {
      sessionId: parsed.data.sessionId,
      reason: "blocked",
      endedAt: now.toISOString(),
    },
    result.userIds,
  );
  emitCampusMatchStateChanged(result.userIds);

  return { success: true, data: undefined };
}

// ─── sendCampusMatchMessage ──────────────────────────────────────────────────

export async function sendCampusMatchMessage(
  input: z.infer<typeof sendMessageSchema>,
): Promise<ActionResult<CampusMatchMessageData>> {
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

  const abused = await guardAction("campus-match.message", { userId, contentBody: body ?? undefined });
  if (abused) return abused;

  const banBlocked = await ensureUserNotBanned(userId);
  if (banBlocked) return banBlocked;

  const result = await db.transaction(async (tx) => {
    const locked = await lockActiveSessionForParticipant(
      tx,
      parsed.data.sessionId,
      userId,
      "send_message",
    );
    if (!locked.success) {
      return {
        error: locked.error,
        message: null as CampusMatchMessageData | null,
        userIds: [] as string[],
      };
    }

    const blockCheck = await assertCampusMatchInteractionAllowed(userId, locked.data.partner.userId);
    if (blockCheck && !blockCheck.success) {
      return {
        error: blockCheck.error,
        message: null as CampusMatchMessageData | null,
        userIds: [] as string[],
      };
    }

    const [newMessage] = await tx
      .insert(cmMessage)
      .values({
        sessionId: parsed.data.sessionId,
        senderId: userId,
        body,
        imageUrl,
      })
      .returning({
        id: cmMessage.id,
        sessionId: cmMessage.sessionId,
        senderId: cmMessage.senderId,
        body: cmMessage.body,
        imageUrl: cmMessage.imageUrl,
        createdAt: cmMessage.createdAt,
      });

    return {
      error: null as string | null,
      userIds: locked.data.participants.map((p) => p.userId),
      message: {
        id: newMessage.id,
        sessionId: newMessage.sessionId,
        senderId: newMessage.senderId,
        senderAlias: locked.data.me.alias,
        body: newMessage.body,
        imageUrl: newMessage.imageUrl,
        createdAt: newMessage.createdAt.toISOString(),
      },
    };
  });

  if (result.error || !result.message) {
    return { success: false, error: result.error ?? "Unable to send message" };
  }

  emitCampusMatchUserEvent(
    "campus_match_message",
    {
      sessionId: parsed.data.sessionId,
      message: result.message,
    },
    result.userIds,
  );

  return { success: true, data: result.message };
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
