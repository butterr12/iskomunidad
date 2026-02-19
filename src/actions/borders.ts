"use server";

import { db } from "@/lib/db";
import {
  userSelectedBorder,
  userUnlockedBorder,
  user as userTable,
} from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getSession, requireAdmin, type ActionResult } from "./_helpers";
import {
  getBorderById,
  PROFILE_BORDER_CATALOG,
  type BorderDefinition,
} from "@/lib/profile-borders";

// ─── Public queries ─────────────────────────────────────────────────────────

/** Get the active border for a user by username */
export async function getUserBorderSelection(
  username: string,
): Promise<ActionResult<BorderDefinition | null>> {
  try {
    const userRow = await db.query.user.findFirst({
      where: eq(userTable.username, username.toLowerCase()),
      columns: { id: true },
    });
    if (!userRow) return { success: true, data: null };

    const row = await db.query.userSelectedBorder.findFirst({
      where: eq(userSelectedBorder.userId, userRow.id),
    });
    if (!row) return { success: true, data: null };

    return { success: true, data: getBorderById(row.borderId) };
  } catch {
    return { success: false, error: "Failed to load border selection" };
  }
}

/** Get the active border for a user by userId */
export async function getUserBorderSelectionById(
  userId: string,
): Promise<ActionResult<BorderDefinition | null>> {
  try {
    const row = await db.query.userSelectedBorder.findFirst({
      where: eq(userSelectedBorder.userId, userId),
    });
    if (!row) return { success: true, data: null };

    return { success: true, data: getBorderById(row.borderId) };
  } catch {
    return { success: false, error: "Failed to load border selection" };
  }
}

// ─── Authenticated mutations ────────────────────────────────────────────────

/** Set the active border for the current user */
export async function setUserBorderSelection(
  borderId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  // Validate border exists in catalog
  const border = PROFILE_BORDER_CATALOG.find((b) => b.id === borderId);
  if (!border) return { success: false, error: "Invalid border" };

  // "none" → delete the row
  if (borderId === "none") {
    await db
      .delete(userSelectedBorder)
      .where(eq(userSelectedBorder.userId, session.user.id));
    return { success: true, data: undefined };
  }

  // Non-basic borders require an unlock
  if (border.tier !== "basic") {
    const unlock = await db.query.userUnlockedBorder.findFirst({
      where: and(
        eq(userUnlockedBorder.userId, session.user.id),
        eq(userUnlockedBorder.borderId, borderId),
      ),
    });
    if (!unlock) {
      return { success: false, error: "You haven't unlocked this border" };
    }
  }

  // Upsert selection
  await db
    .insert(userSelectedBorder)
    .values({ userId: session.user.id, borderId })
    .onConflictDoUpdate({
      target: userSelectedBorder.userId,
      set: { borderId, updatedAt: new Date() },
    });

  return { success: true, data: undefined };
}

/** Get list of unlocked border IDs for the current user */
export async function getUserUnlockedBorders(): Promise<
  ActionResult<string[]>
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  try {
    const rows = await db.query.userUnlockedBorder.findMany({
      where: eq(userUnlockedBorder.userId, session.user.id),
      columns: { borderId: true },
    });
    return { success: true, data: rows.map((r) => r.borderId) };
  } catch {
    return { success: false, error: "Failed to load unlocked borders" };
  }
}

// ─── Admin actions ──────────────────────────────────────────────────────────

/** Admin: get unlocked border definitions for a user */
export async function adminGetUserUnlockedBorders(
  userId: string,
): Promise<ActionResult<BorderDefinition[]>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Admin access required" };

  try {
    const rows = await db.query.userUnlockedBorder.findMany({
      where: eq(userUnlockedBorder.userId, userId),
      columns: { borderId: true },
    });
    const borders = rows
      .map((r) => PROFILE_BORDER_CATALOG.find((b) => b.id === r.borderId))
      .filter((b): b is BorderDefinition => !!b);
    return { success: true, data: borders };
  } catch {
    return { success: false, error: "Failed to load unlocked borders" };
  }
}

/** Admin: grant a border unlock to a user */
export async function adminGrantBorder(
  userId: string,
  borderId: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Admin access required" };

  const border = PROFILE_BORDER_CATALOG.find((b) => b.id === borderId);
  if (!border) return { success: false, error: "Invalid border" };

  await db
    .insert(userUnlockedBorder)
    .values({ userId, borderId })
    .onConflictDoNothing();

  return { success: true, data: undefined };
}

/** Admin: revoke a border unlock from a user */
export async function adminRevokeBorder(
  userId: string,
  borderId: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Admin access required" };

  await db
    .delete(userUnlockedBorder)
    .where(
      and(
        eq(userUnlockedBorder.userId, userId),
        eq(userUnlockedBorder.borderId, borderId),
      ),
    );

  // If the user had this border selected, remove that too
  const selection = await db.query.userSelectedBorder.findFirst({
    where: eq(userSelectedBorder.userId, userId),
  });
  if (selection?.borderId === borderId) {
    await db
      .delete(userSelectedBorder)
      .where(eq(userSelectedBorder.userId, userId));
  }

  return { success: true, data: undefined };
}
