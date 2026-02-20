"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit, type RateLimitTier } from "@/lib/rate-limit";
import {
  adminSetting,
  adminNotification,
  userNotification,
  userNotificationSetting,
  session as authSession,
  user as authUser,
} from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  buildApprovalMessage,
  buildPendingMessage,
  buildRejectionMessage,
  buildActivityMessage,
} from "@/lib/notification-messages";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  areNotificationsEnabledForContentType,
} from "@/lib/notification-preferences";

// ─── ActionResult type ────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) return null;

  const userStatus = session.user.status;
  if (userStatus && userStatus !== "active") {
    await revokeUserSessions(session.user.id);
    return null;
  }

  const userRow = await db.query.user.findFirst({
    where: eq(authUser.id, session.user.id),
    columns: { status: true },
  });
  if (!userRow || userRow.status !== "active") {
    await revokeUserSessions(session.user.id);
    return null;
  }

  return session;
}

export async function getOptionalSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session;
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session) return null;
  if (session.user.role !== "admin") return null;
  return session;
}

export async function revokeUserSessions(userId: string) {
  await db.delete(authSession).where(eq(authSession.userId, userId));
}

// ─── Request helpers ─────────────────────────────────────────────────────────

export async function getClientIp(headersList: Headers): Promise<string | null> {
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headersList.get("x-real-ip") ??
    headersList.get("cf-connecting-ip") ??
    null
  );
}

// ─── Rate limiting ───────────────────────────────────────────────────────────

/**
 * Check rate limit for the current request IP.
 * Returns an error ActionResult if over the limit, or `null` if allowed.
 *
 * Usage in any server action:
 *   const limited = await rateLimit("create");
 *   if (limited) return limited;
 */
export async function rateLimit(
  tier: RateLimitTier,
): Promise<ActionResult<never> | null> {
  const hdrs = await headers();
  const ip = (await getClientIp(hdrs)) ?? "unknown";
  const result = checkRateLimit(tier, ip);
  if (!result.allowed) {
    return { success: false, error: "Too many requests. Please try again later." };
  }
  return null;
}

// ─── Abuse guard ─────────────────────────────────────────────────────────────

import type { AbuseAction, GuardOptions, AbuseResult } from "@/lib/abuse/types";
import { guard } from "@/lib/abuse/guard";
import { resolveIdentity } from "@/lib/abuse/identity";

/**
 * Check abuse policy for the current request.
 * Returns an error ActionResult if over the limit, or `null` if allowed.
 *
 * Usage in any server action:
 *   const limited = await guardAction("post.create", { contentBody: title + body });
 *   if (limited) return limited;
 */
export async function guardAction(
  action: AbuseAction,
  opts?: GuardOptions & { userId?: string; email?: string },
): Promise<ActionResult<never> | null> {
  const userId = opts?.userId;
  const identity = opts?.identity ?? await resolveIdentity(userId, { email: opts?.email });
  const result = await guard(action, identity, opts);

  if (result.decision === "deny" || result.decision === "throttle") {
    return { success: false, error: "Too many requests. Please try again later." };
  }
  return null;
}

/**
 * Like guardAction but exposes the full decision for callers needing degrade_to_review awareness.
 */
export async function guardActionWithDecision(
  action: AbuseAction,
  opts?: GuardOptions & { userId?: string; email?: string },
): Promise<{ limited: ActionResult<never> | null; decision: AbuseResult }> {
  const userId = opts?.userId;
  const identity = opts?.identity ?? await resolveIdentity(userId, { email: opts?.email });
  const result = await guard(action, identity, opts);

  if (result.decision === "deny" || result.decision === "throttle") {
    return {
      limited: { success: false, error: "Too many requests. Please try again later." },
      decision: result,
    };
  }
  return { limited: null, decision: result };
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

export type ApprovalMode = "auto" | "manual" | "ai";
export type ModerationPreset = "strict" | "moderate" | "relaxed";

export async function getApprovalMode(): Promise<ApprovalMode> {
  // Check new key first
  const row = await db.query.adminSetting.findFirst({
    where: eq(adminSetting.key, "approvalMode"),
  });
  if (row) return row.value as ApprovalMode;

  // Backwards compat: fall back to legacy boolean key
  const legacy = await db.query.adminSetting.findFirst({
    where: eq(adminSetting.key, "autoApprove"),
  });
  if (legacy) return (legacy.value as boolean) ? "auto" : "manual";

  return "auto"; // default
}

export async function getAutoApproveSetting(): Promise<boolean> {
  return (await getApprovalMode()) !== "manual";
}

export async function getModerationPreset(): Promise<ModerationPreset> {
  const row = await db.query.adminSetting.findFirst({
    where: eq(adminSetting.key, "moderationPreset"),
  });
  if (row && ["strict", "moderate", "relaxed"].includes(row.value as string)) {
    return row.value as ModerationPreset;
  }
  return "moderate";
}

export async function getCustomModerationRules(): Promise<string> {
  const row = await db.query.adminSetting.findFirst({
    where: eq(adminSetting.key, "customModerationRules"),
  });
  if (row && typeof row.value === "string") return row.value;
  return "";
}

// ─── Campus Match kill switch ─────────────────────────────────────────────────

export async function getCampusMatchEnabled(): Promise<boolean> {
  const row = await db.query.adminSetting.findFirst({
    where: eq(adminSetting.key, "campusMatchEnabled"),
  });
  if (row && typeof row.value === "boolean") return row.value;
  return true; // default: enabled
}

export async function requireCampusMatch(): Promise<ActionResult<never> | null> {
  const enabled = await getCampusMatchEnabled();
  if (!enabled) return { success: false, error: "Campus Match is currently disabled" };
  return null;
}

// ─── Notification helpers ─────────────────────────────────────────────────────

export async function createNotification(data: {
  type: string;
  targetId: string;
  targetTitle: string;
  authorHandle: string;
  reason?: string;
}) {
  await db.insert(adminNotification).values({
    type: data.type,
    targetId: data.targetId,
    targetTitle: data.targetTitle,
    authorHandle: data.authorHandle,
    reason: data.reason ?? null,
  });
}

export async function createUserNotification(data: {
  userId: string;
  type: string;        // "post_rejected", "gig_approved", etc.
  contentType: string; // "post", "gig", "event", "landmark"
  targetId: string;
  targetTitle: string;
  reason?: string;
  actor?: string;
}) {
  const preferenceRow = await db.query.userNotificationSetting.findFirst({
    where: eq(userNotificationSetting.userId, data.userId),
    columns: {
      posts: true,
      events: true,
      gigs: true,
    },
  });
  const preferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...preferenceRow,
  };
  const isModerationLifecycleNotification =
    data.type.endsWith("_approved") ||
    data.type.endsWith("_rejected") ||
    data.type.endsWith("_pending");
  if (
    !isModerationLifecycleNotification &&
    !areNotificationsEnabledForContentType(data.contentType, preferences)
  ) {
    return;
  }

  let message: string;
  if (data.type.endsWith("_approved")) {
    message = buildApprovalMessage(data.contentType, data.targetTitle);
  } else if (data.type.endsWith("_rejected")) {
    message = buildRejectionMessage(data.contentType, data.targetTitle, data.reason);
  } else if (data.type.endsWith("_pending")) {
    message = buildPendingMessage(data.contentType, data.targetTitle);
  } else {
    message = buildActivityMessage({
      type: data.type,
      targetTitle: data.targetTitle,
      actor: data.actor,
    });
  }

  await db.insert(userNotification).values({
    userId: data.userId,
    type: data.type,
    contentType: data.contentType,
    targetId: data.targetId,
    targetTitle: data.targetTitle,
    message,
  });
}
