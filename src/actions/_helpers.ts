"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  adminSetting,
  adminNotification,
  userNotification,
  userNotificationSetting,
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

export async function getSessionOrThrow() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
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
  const session = await getSessionOrThrow();
  if (!session) return null;
  if (session.user.role !== "admin") return null;
  return session;
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
