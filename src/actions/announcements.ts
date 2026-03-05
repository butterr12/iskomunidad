"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { announcement, announcementSeen } from "@/lib/schema";
import { eq, and, or, isNull, gt, desc } from "drizzle-orm";
import { requireAdmin, getSession } from "./_helpers";
import type { ActionResult } from "./_helpers";

export type Announcement = typeof announcement.$inferSelect;

const announcementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  body: z.string().max(2000).optional().nullable(),
  imageKey: z.string().optional().nullable(),
  ctaLabel: z.string().max(50).optional().nullable(),
  ctaUrl: z
    .string()
    .refine((v) => !v || /^https?:\/\//i.test(v), "URL must start with http:// or https://")
    .optional()
    .nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

export async function adminGetAnnouncements(): Promise<
  ActionResult<Announcement[]>
> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const announcements = await db
    .select()
    .from(announcement)
    .orderBy(desc(announcement.createdAt));

  return { success: true, data: announcements };
}

export async function adminCreateAnnouncement(
  input: z.infer<typeof announcementSchema>,
): Promise<ActionResult<Announcement>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const { ctaUrl, expiresAt, isActive, imageKey, ...rest } = parsed.data;

  const [created] = await db
    .insert(announcement)
    .values({
      ...rest,
      imageKey: imageKey || null,
      ctaUrl: ctaUrl || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: isActive ?? true,
    })
    .returning();

  return { success: true, data: created };
}

export async function adminUpdateAnnouncement(
  id: string,
  input: z.infer<typeof announcementSchema>,
): Promise<ActionResult<Announcement>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const { ctaUrl, expiresAt, isActive, imageKey, ...rest } = parsed.data;

  const [updated] = await db
    .update(announcement)
    .set({
      ...rest,
      imageKey: imageKey || null,
      ctaUrl: ctaUrl || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      ...(isActive !== undefined ? { isActive } : {}),
    })
    .where(eq(announcement.id, id))
    .returning();

  if (!updated) return { success: false, error: "Announcement not found" };
  return { success: true, data: updated };
}

export async function adminDeleteAnnouncement(
  id: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  await db.delete(announcement).where(eq(announcement.id, id));
  return { success: true, data: undefined };
}

export async function adminToggleAnnouncement(
  id: string,
  isActive: boolean,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  await db
    .update(announcement)
    .set({ isActive })
    .where(eq(announcement.id, id));
  return { success: true, data: undefined };
}

export async function getUnseenAnnouncements(): Promise<
  ActionResult<Announcement[]>
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Sign in required" };

  const now = new Date();

  const rows = await db
    .select({ announcement })
    .from(announcement)
    .leftJoin(
      announcementSeen,
      and(
        eq(announcementSeen.announcementId, announcement.id),
        eq(announcementSeen.userId, session.user.id),
      ),
    )
    .where(
      and(
        eq(announcement.isActive, true),
        or(isNull(announcement.expiresAt), gt(announcement.expiresAt, now)),
        isNull(announcementSeen.id),
      ),
    )
    .orderBy(desc(announcement.priority), desc(announcement.createdAt));

  const announcements = rows.map((r) => r.announcement);

  return { success: true, data: announcements };
}

export async function markAnnouncementSeen(
  announcementId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session)
    return { success: false, error: "Sign in to dismiss announcements" };

  await db
    .insert(announcementSeen)
    .values({ announcementId, userId: session.user.id })
    .onConflictDoNothing();

  return { success: true, data: undefined };
}
