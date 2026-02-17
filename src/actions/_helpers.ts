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
  if ((session.user as Record<string, unknown>).role !== "admin") return null;
  return session;
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

export async function getAutoApproveSetting(): Promise<boolean> {
  const row = await db.query.adminSetting.findFirst({
    where: eq(adminSetting.key, "autoApprove"),
  });
  if (!row) return true; // default: auto-approve
  return row.value as boolean;
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
