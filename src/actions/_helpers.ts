"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminSetting, adminNotification } from "@/lib/schema";
import { eq } from "drizzle-orm";

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
