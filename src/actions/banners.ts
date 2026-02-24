"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { banner, bannerDismissal } from "@/lib/schema";
import { eq, and, or, isNull, gt, desc, notInArray } from "drizzle-orm";
import { requireAdmin, getSession, getOptionalSession } from "./_helpers";
import type { ActionResult } from "./_helpers";

export type Banner = typeof banner.$inferSelect;

const bannerSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  body: z.string().max(1000).optional(),
  variant: z.enum(["info", "warning", "urgent", "success"]),
  ctaLabel: z.string().max(50).optional(),
  ctaUrl: z.string().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function adminGetBanners(): Promise<ActionResult<Banner[]>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const banners = await db
    .select()
    .from(banner)
    .orderBy(desc(banner.createdAt));

  return { success: true, data: banners };
}

export async function adminCreateBanner(
  input: z.infer<typeof bannerSchema>,
): Promise<ActionResult<Banner>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const { ctaUrl, expiresAt, isActive, ...rest } = parsed.data;

  const [created] = await db
    .insert(banner)
    .values({
      ...rest,
      ctaUrl: ctaUrl || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: isActive ?? true,
    })
    .returning();

  return { success: true, data: created };
}

export async function adminUpdateBanner(
  id: string,
  input: z.infer<typeof bannerSchema>,
): Promise<ActionResult<Banner>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const { ctaUrl, expiresAt, isActive, ...rest } = parsed.data;

  const [updated] = await db
    .update(banner)
    .set({
      ...rest,
      ctaUrl: ctaUrl || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      ...(isActive !== undefined ? { isActive } : {}),
    })
    .where(eq(banner.id, id))
    .returning();

  if (!updated) return { success: false, error: "Banner not found" };
  return { success: true, data: updated };
}

export async function adminDeleteBanner(
  id: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  await db.delete(banner).where(eq(banner.id, id));
  return { success: true, data: undefined };
}

export async function adminToggleBanner(
  id: string,
  isActive: boolean,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  await db.update(banner).set({ isActive }).where(eq(banner.id, id));
  return { success: true, data: undefined };
}

export async function getActiveBanners(): Promise<ActionResult<Banner[]>> {
  const session = await getOptionalSession();
  const now = new Date();

  let dismissedIds: string[] = [];
  if (session?.user?.id) {
    const dismissed = await db
      .select({ bannerId: bannerDismissal.bannerId })
      .from(bannerDismissal)
      .where(eq(bannerDismissal.userId, session.user.id));
    dismissedIds = dismissed.map((d) => d.bannerId);
  }

  const baseCondition = and(
    eq(banner.isActive, true),
    or(isNull(banner.expiresAt), gt(banner.expiresAt, now)),
  );

  const banners = await db
    .select()
    .from(banner)
    .where(
      dismissedIds.length > 0
        ? and(baseCondition, notInArray(banner.id, dismissedIds))
        : baseCondition,
    )
    .orderBy(desc(banner.createdAt));

  return { success: true, data: banners };
}

export async function dismissBanner(
  bannerId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Sign in to dismiss banners" };

  await db
    .insert(bannerDismissal)
    .values({ bannerId, userId: session.user.id })
    .onConflictDoNothing();

  return { success: true, data: undefined };
}
