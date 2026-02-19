"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { cmPreference } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  type ActionResult,
  getSession,
  rateLimit,
  getCampusMatchEnabled,
  requireCampusMatch,
} from "./_helpers";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const aliasSchema = z.string().min(3).max(24).regex(/^[a-zA-Z0-9 ]+$/);
const scopeSchema = z.enum(["same-campus", "all-campuses"]);
const sessionIdSchema = z.string().uuid();

const updatePreferenceSchema = z.object({
  allowAnonQueue: z.boolean().optional(),
  defaultAlias: aliasSchema.nullable().optional(),
  lastScope: scopeSchema.nullable().optional(),
});

const joinQueueSchema = z.object({
  alias: aliasSchema,
  scope: scopeSchema,
});

const reportUserSchema = z.object({
  sessionId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

const sendMessageSchema = z
  .object({
    sessionId: z.string().uuid(),
    body: z.string().max(2000).optional(),
    imageUrl: z.string().optional(),
  })
  .refine((data) => data.body || data.imageUrl, {
    message: "Message must have a body or image",
  });

// ─── Types ───────────────────────────────────────────────────────────────────

type MatchScope = "same-campus" | "all-campuses";

export type CampusMatchPreference = {
  allowAnonQueue: boolean;
  defaultAlias: string | null;
  lastScope: MatchScope | null;
};

export type QueueStatus = {
  inQueue: boolean;
  inSession: boolean;
};

// ─── getCampusMatchEnabledAction ────────────────────────────────────────────

export async function getCampusMatchEnabledAction(): Promise<
  ActionResult<boolean>
> {
  const enabled = await getCampusMatchEnabled();
  return { success: true, data: enabled };
}

// ─── getCampusMatchPreference ───────────────────────────────────────────────

export async function getCampusMatchPreference(): Promise<
  ActionResult<CampusMatchPreference>
> {
  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  const pref = await db.query.cmPreference.findFirst({
    where: eq(cmPreference.userId, authSession.user.id),
  });

  return {
    success: true,
    data: {
      allowAnonQueue: pref?.allowAnonQueue ?? true,
      defaultAlias: pref?.defaultAlias ?? null,
      lastScope: (pref?.lastScope as MatchScope) ?? null,
    },
  };
}

// ─── updateCampusMatchPreference ────────────────────────────────────────────

export async function updateCampusMatchPreference(
  input: z.infer<typeof updatePreferenceSchema>,
): Promise<ActionResult<void>> {
  const parsed = updatePreferenceSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  await db
    .insert(cmPreference)
    .values({
      userId: authSession.user.id,
      allowAnonQueue: parsed.data.allowAnonQueue ?? true,
      defaultAlias: parsed.data.defaultAlias ?? null,
      lastScope: parsed.data.lastScope ?? null,
    })
    .onConflictDoUpdate({
      target: cmPreference.userId,
      set: {
        ...(parsed.data.allowAnonQueue !== undefined && {
          allowAnonQueue: parsed.data.allowAnonQueue,
        }),
        ...(parsed.data.defaultAlias !== undefined && {
          defaultAlias: parsed.data.defaultAlias,
        }),
        ...(parsed.data.lastScope !== undefined && {
          lastScope: parsed.data.lastScope,
        }),
      },
    });

  return { success: true, data: undefined };
}

// ─── joinQueue ──────────────────────────────────────────────────────────────

export async function joinQueue(
  input: z.infer<typeof joinQueueSchema>,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;
  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = joinQueueSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  return { success: false, error: "Not implemented" };
}

// ─── leaveQueue ─────────────────────────────────────────────────────────────

export async function leaveQueue(): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;
  const limited = await rateLimit("create");
  if (limited) return limited;
  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  return { success: false, error: "Not implemented" };
}

// ─── getQueueStatus ─────────────────────────────────────────────────────────

export async function getQueueStatus(): Promise<ActionResult<QueueStatus>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;
  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  return { success: true, data: { inQueue: false, inSession: false } };
}

// ─── heartbeat ──────────────────────────────────────────────────────────────

export async function heartbeat(): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;
  const limited = await rateLimit("general");
  if (limited) return limited;
  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  return { success: false, error: "Not implemented" };
}

// ─── skipSession ────────────────────────────────────────────────────────────

export async function skipSession(
  sessionId: string,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;
  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  return { success: false, error: "Not implemented" };
}

// ─── endSession ─────────────────────────────────────────────────────────────

export async function endSession(
  sessionId: string,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;
  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  return { success: false, error: "Not implemented" };
}

// ─── requestConnect ─────────────────────────────────────────────────────────

export async function requestConnect(
  sessionId: string,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;
  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  return { success: false, error: "Not implemented" };
}

// ─── declineConnect ─────────────────────────────────────────────────────────

export async function declineConnect(
  sessionId: string,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;
  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  return { success: false, error: "Not implemented" };
}

// ─── reportUser ─────────────────────────────────────────────────────────────

export async function reportUser(
  input: z.infer<typeof reportUserSchema>,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;
  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = reportUserSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  return { success: false, error: "Not implemented" };
}

// ─── blockUser ──────────────────────────────────────────────────────────────

export async function blockUser(
  sessionId: string,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;
  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  return { success: false, error: "Not implemented" };
}

// ─── sendAnonMessage ────────────────────────────────────────────────────────

export async function sendAnonMessage(
  input: z.infer<typeof sendMessageSchema>,
): Promise<ActionResult<void>> {
  const killed = await requireCampusMatch();
  if (killed) return killed;
  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const authSession = await getSession();
  if (!authSession) return { success: false, error: "Not authenticated" };

  return { success: false, error: "Not implemented" };
}
