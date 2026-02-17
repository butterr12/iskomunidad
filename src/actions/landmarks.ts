"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { landmark, landmarkPhoto, landmarkReview } from "@/lib/schema";
import { eq, sql, and } from "drizzle-orm";
import {
  type ActionResult,
  getSessionOrThrow,
  getAutoApproveSetting,
  createNotification,
} from "./_helpers";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createLandmarkSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(["attraction", "community", "event"]),
  lat: z.number(),
  lng: z.number(),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  operatingHours: z.unknown().optional(),
  tags: z.array(z.string()).default([]),
  photos: z
    .array(z.object({ url: z.string(), caption: z.string().optional() }))
    .default([]),
});

const createReviewSchema = z.object({
  landmarkId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().optional(),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getApprovedLandmarks(): Promise<ActionResult<unknown[]>> {
  const rows = await db.query.landmark.findMany({
    where: eq(landmark.status, "approved"),
    with: { photos: true },
    orderBy: (l, { desc }) => [desc(l.createdAt)],
  });

  return {
    success: true,
    data: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      photos: r.photos.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
    })),
  };
}

export async function getLandmarkById(
  id: string,
): Promise<ActionResult<unknown>> {
  const row = await db.query.landmark.findFirst({
    where: eq(landmark.id, id),
    with: {
      photos: true,
      reviews: {
        with: {
          user: { columns: { name: true, username: true, image: true } },
        },
        orderBy: (r, { desc }) => [desc(r.createdAt)],
      },
    },
  });

  if (!row) return { success: false, error: "Landmark not found" };

  return {
    success: true,
    data: {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      photos: row.photos.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
      reviews: row.reviews.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        author: r.user.name,
        authorHandle: r.user.username ? `@${r.user.username}` : null,
        authorImage: r.user.image,
      })),
    },
  };
}

export async function createLandmark(
  input: z.infer<typeof createLandmarkSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createLandmarkSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  const autoApprove = await getAutoApproveSetting();
  const status = autoApprove ? "approved" : "draft";

  const { photos, ...landmarkData } = parsed.data;

  const [created] = await db
    .insert(landmark)
    .values({
      ...landmarkData,
      operatingHours: landmarkData.operatingHours ?? null,
      status,
      userId: session.user.id,
    })
    .returning({ id: landmark.id });

  if (photos.length > 0) {
    await db.insert(landmarkPhoto).values(
      photos.map((p, i) => ({
        landmarkId: created.id,
        url: p.url,
        caption: p.caption ?? null,
        order: i,
      })),
    );
  }

  if (!autoApprove) {
    await createNotification({
      type: "landmark_pending",
      targetId: created.id,
      targetTitle: parsed.data.name,
      authorHandle: session.user.username ?? session.user.name,
    });
  }

  return { success: true, data: { id: created.id } };
}

export async function createLandmarkReview(
  input: z.infer<typeof createReviewSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createReviewSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  // Upsert review (one review per user per landmark)
  const [upserted] = await db
    .insert(landmarkReview)
    .values({
      landmarkId: parsed.data.landmarkId,
      userId: session.user.id,
      rating: parsed.data.rating,
      body: parsed.data.body ?? null,
    })
    .onConflictDoUpdate({
      target: [landmarkReview.userId, landmarkReview.landmarkId],
      set: {
        rating: parsed.data.rating,
        body: parsed.data.body ?? null,
      },
    })
    .returning({ id: landmarkReview.id });

  // Recalculate avgRating and reviewCount
  const [stats] = await db
    .select({
      avg: sql<number>`COALESCE(AVG(${landmarkReview.rating}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(landmarkReview)
    .where(eq(landmarkReview.landmarkId, parsed.data.landmarkId));

  await db
    .update(landmark)
    .set({
      avgRating: Number(stats.avg),
      reviewCount: Number(stats.count),
    })
    .where(eq(landmark.id, parsed.data.landmarkId));

  return { success: true, data: { id: upserted.id } };
}
