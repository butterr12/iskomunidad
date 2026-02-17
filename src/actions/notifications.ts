"use server";

import { db } from "@/lib/db";
import { userNotification } from "@/lib/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { type ActionResult, getSessionOrThrow } from "./_helpers";

export async function getUserNotifications(): Promise<ActionResult<unknown[]>> {
  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  const rows = await db.query.userNotification.findMany({
    where: eq(userNotification.userId, session.user.id),
    orderBy: [desc(userNotification.createdAt)],
    limit: 50,
  });

  return {
    success: true,
    data: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function getUnreadNotificationCount(): Promise<
  ActionResult<{ count: number }>
> {
  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userNotification)
    .where(
      and(
        eq(userNotification.userId, session.user.id),
        eq(userNotification.isRead, false),
      ),
    );

  return { success: true, data: { count: Number(result.count) } };
}

export async function markNotificationAsRead(
  id: string,
): Promise<ActionResult<void>> {
  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  await db
    .update(userNotification)
    .set({ isRead: true })
    .where(
      and(
        eq(userNotification.id, id),
        eq(userNotification.userId, session.user.id),
      ),
    );

  return { success: true, data: undefined };
}

export async function markAllNotificationsAsRead(): Promise<
  ActionResult<void>
> {
  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  await db
    .update(userNotification)
    .set({ isRead: true })
    .where(
      and(
        eq(userNotification.userId, session.user.id),
        eq(userNotification.isRead, false),
      ),
    );

  return { success: true, data: undefined };
}
