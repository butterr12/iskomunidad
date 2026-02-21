import { db } from "@/lib/db";
import { userFlair } from "@/lib/schema";
import { user as userTable } from "@/lib/auth-schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  USER_FLAIR_CATALOG,
  getBasicFlairIds,
  getCampusFlairId,
  type DisplayFlair,
} from "@/lib/user-flairs";

const MAX_VISIBLE = 3;

// ─── Core operations ────────────────────────────────────────────────────────

export async function grantFlair(
  userId: string,
  flairId: string,
  source: string,
) {
  await db
    .insert(userFlair)
    .values({ userId, flairId, source, visible: false })
    .onConflictDoNothing();
}

export async function revokeFlair(userId: string, flairId: string) {
  await db
    .delete(userFlair)
    .where(and(eq(userFlair.userId, userId), eq(userFlair.flairId, flairId)));
}

// ─── Lazy seeding ───────────────────────────────────────────────────────────

export async function ensureBasicFlairs(userId: string) {
  const existing = await db.query.userFlair.findMany({
    where: eq(userFlair.userId, userId),
    columns: { flairId: true },
  });
  const owned = new Set(existing.map((r) => r.flairId));

  // Seed basic flairs
  const basicIds = getBasicFlairIds();
  const missingBasic = basicIds.filter((id) => !owned.has(id));
  if (missingBasic.length > 0) {
    await db
      .insert(userFlair)
      .values(
        missingBasic.map((flairId) => ({
          userId,
          flairId,
          source: "basic-seed",
          visible: false,
        })),
      )
      .onConflictDoNothing();
  }

  // Seed campus flair if user has a university set
  const userRow = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
    columns: { university: true },
  });
  if (userRow?.university) {
    const campusId = getCampusFlairId(userRow.university);
    if (campusId && !owned.has(campusId)) {
      await db
        .insert(userFlair)
        .values({
          userId,
          flairId: campusId,
          source: "university-sync",
          visible: false,
        })
        .onConflictDoNothing();
    }
  }
}

// ─── Query ──────────────────────────────────────────────────────────────────

export async function getUserFlairsFromDb(
  userId: string,
): Promise<DisplayFlair[]> {
  await ensureBasicFlairs(userId);

  const rows = await db.query.userFlair.findMany({
    where: eq(userFlair.userId, userId),
  });

  return rows
    .map((row) => {
      const def = USER_FLAIR_CATALOG.find((f) => f.id === row.flairId);
      if (!def) return null;
      return { ...def, visible: row.visible } satisfies DisplayFlair;
    })
    .filter((f): f is DisplayFlair => f !== null);
}

export async function getVisibleFlairsByUsername(
  username: string,
): Promise<DisplayFlair[]> {
  const userRow = await db.query.user.findFirst({
    where: eq(userTable.username, username.toLowerCase()),
    columns: { id: true },
  });
  if (!userRow) return [];

  await ensureBasicFlairs(userRow.id);

  const rows = await db.query.userFlair.findMany({
    where: and(eq(userFlair.userId, userRow.id), eq(userFlair.visible, true)),
  });

  return rows
    .map((row) => {
      const def = USER_FLAIR_CATALOG.find((f) => f.id === row.flairId);
      if (!def) return null;
      return { ...def, visible: true as boolean } as DisplayFlair;
    })
    .filter((f): f is DisplayFlair => f !== null);
}

// ─── Visibility ─────────────────────────────────────────────────────────────

export async function setFlairVisibility(
  userId: string,
  flairId: string,
  visible: boolean,
): Promise<{ success: boolean; error?: string }> {
  if (visible) {
    // Enforce max visible
    const visibleCount = await db.query.userFlair.findMany({
      where: and(eq(userFlair.userId, userId), eq(userFlair.visible, true)),
      columns: { flairId: true },
    });
    if (visibleCount.length >= MAX_VISIBLE) {
      return {
        success: false,
        error: `You can display at most ${MAX_VISIBLE} flairs`,
      };
    }
  }

  await db
    .update(userFlair)
    .set({ visible })
    .where(and(eq(userFlair.userId, userId), eq(userFlair.flairId, flairId)));

  return { success: true };
}

// ─── Batch query (public views — skips ensureBasicFlairs) ────────────────────

export async function getVisibleFlairsByUsernames(
  usernames: string[],
): Promise<Record<string, DisplayFlair[]>> {
  if (usernames.length === 0) return {};

  // Query 1: bulk user lookup
  const users = await db.query.user.findMany({
    where: inArray(userTable.username, usernames.map((u) => u.toLowerCase())),
    columns: { id: true, username: true },
  });
  if (users.length === 0) return {};

  const userIdToUsername = new Map(users.map((u) => [u.id, u.username!]));
  const userIds = users.map((u) => u.id);

  // Query 2: bulk visible flairs
  const rows = await db.query.userFlair.findMany({
    where: and(
      inArray(userFlair.userId, userIds),
      eq(userFlair.visible, true),
    ),
  });

  // Build result keyed by username
  const result: Record<string, DisplayFlair[]> = {};
  for (const username of usernames) {
    result[username] = [];
  }

  for (const row of rows) {
    const username = userIdToUsername.get(row.userId);
    if (!username) continue;
    const def = USER_FLAIR_CATALOG.find((f) => f.id === row.flairId);
    if (!def) continue;
    if (!result[username]) result[username] = [];
    result[username].push({ ...def, visible: true });
  }

  return result;
}

// ─── University sync ────────────────────────────────────────────────────────

export async function syncCampusFlair(userId: string, university: string) {
  const campusId = getCampusFlairId(university);
  if (!campusId) return;

  await db
    .insert(userFlair)
    .values({
      userId,
      flairId: campusId,
      source: "university-sync",
      visible: true,
    })
    .onConflictDoNothing();
}
