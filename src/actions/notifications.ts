"use server";

import { db } from "@/lib/db";
import { userNotification, userNotificationSetting } from "@/lib/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { type ActionResult, getSession } from "./_helpers";
import { z } from "zod";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@/lib/notification-preferences";

export async function getUserNotifications(): Promise<ActionResult<unknown[]>> {
  const session = await getSession();
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
  const session = await getSession();
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
  const session = await getSession();
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
  const session = await getSession();
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

const notificationPreferencesSchema = z.object({
  posts: z.boolean(),
  events: z.boolean(),
  gigs: z.boolean(),
});

export async function getNotificationPreferences(): Promise<
  ActionResult<NotificationPreferences>
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const row = await db.query.userNotificationSetting.findFirst({
    where: eq(userNotificationSetting.userId, session.user.id),
    columns: {
      posts: true,
      events: true,
      gigs: true,
    },
  });

  return {
    success: true,
    data: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...row,
    },
  };
}

export async function updateNotificationPreferences(
  input: NotificationPreferences,
): Promise<ActionResult<NotificationPreferences>> {
  const parsed = notificationPreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  await db
    .insert(userNotificationSetting)
    .values({
      userId: session.user.id,
      posts: parsed.data.posts,
      events: parsed.data.events,
      gigs: parsed.data.gigs,
    })
    .onConflictDoUpdate({
      target: [userNotificationSetting.userId],
      set: {
        posts: parsed.data.posts,
        events: parsed.data.events,
        gigs: parsed.data.gigs,
        updatedAt: new Date(),
      },
    });

  return {
    success: true,
    data: parsed.data,
  };
}
