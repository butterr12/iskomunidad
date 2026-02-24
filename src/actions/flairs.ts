"use server";

import { type ActionResult, getSession, getOptionalSession, getCursorPromoEnabled, rateLimit } from "./_helpers";
import {
  getUserFlairsFromDb,
  getVisibleFlairsByUsername,
  getVisibleFlairsByUsernames,
  setFlairVisibility,
} from "@/lib/flair-service";
import type { DisplayFlair } from "@/lib/user-flairs";
import { db } from "@/lib/db";
import { userFlair, userUnlockedBorder, userSelectedBorder } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

export async function getMyFlairs(): Promise<ActionResult<DisplayFlair[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const flairs = await getUserFlairsFromDb(session.user.id);
  return { success: true, data: flairs };
}

export async function getFlairsForUser(
  username: string,
): Promise<ActionResult<DisplayFlair[]>> {
  const flairs = await getVisibleFlairsByUsername(username);
  return { success: true, data: flairs };
}

export async function getFlairsForUsers(
  usernames: string[],
): Promise<ActionResult<Record<string, DisplayFlair[]>>> {
  const capped = usernames.slice(0, 50);
  const flairs = await getVisibleFlairsByUsernames(capped);
  return { success: true, data: flairs };
}

export async function toggleFlairVisibility(
  flairId: string,
  visible: boolean,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const result = await setFlairVisibility(session.user.id, flairId, visible);
  if (!result.success) {
    return { success: false, error: result.error! };
  }
  return { success: true, data: undefined };
}

// ─── Cursor Promo ─────────────────────────────────────────────────────────────

export async function checkCursorPromoStatus(): Promise<
  ActionResult<{ enabled: boolean; claimed: boolean }>
> {
  const [session, enabled] = await Promise.all([getOptionalSession(), getCursorPromoEnabled()]);
  if (!session?.user) return { success: true, data: { enabled, claimed: false } };
  const existing = await db.query.userFlair.findFirst({
    where: and(
      eq(userFlair.userId, session.user.id),
      eq(userFlair.flairId, "cursor-promo"),
    ),
  });
  return { success: true, data: { enabled, claimed: !!existing } };
}

export async function claimCursorPromo(): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  const limited = await rateLimit("general");
  if (limited) return limited;
  const enabled = await getCursorPromoEnabled();
  if (!enabled) return { success: false, error: "Promo is no longer active" };
  await db.transaction(async (tx) => {
    await tx
      .insert(userFlair)
      .values({ userId: session.user.id, flairId: "cursor-promo", source: "system", visible: false })
      .onConflictDoNothing();
    await tx
      .insert(userUnlockedBorder)
      .values({ userId: session.user.id, borderId: "cursor" })
      .onConflictDoNothing();
    await tx
      .insert(userSelectedBorder)
      .values({ userId: session.user.id, borderId: "cursor" })
      .onConflictDoUpdate({
        target: [userSelectedBorder.userId],
        set: { borderId: "cursor" },
      });
  });
  return { success: true, data: undefined };
}
