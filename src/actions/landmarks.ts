"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
  landmark,
  landmarkPhoto,
  landmarkReview,
  landmarkEdit,
  placeCategory,
  campusEvent,
} from "@/lib/schema";
import { eq, and, gte, isNotNull, sql } from "drizzle-orm";
import {
  type ActionResult,
  getSession,
  getOptionalSession,
  guardAction,
  getApprovalMode,
  createNotification,
  createUserNotification,
} from "./_helpers";
import type { LandmarkBanner } from "@/lib/landmarks";
import { moderateContent } from "@/lib/ai-moderation";

function toPhotoProxyUrl(key: string): string {
  return `/api/photos/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

// ─── Place Categories ────────────────────────────────────────────────────────

export async function getPlaceCategories(): Promise<ActionResult<unknown[]>> {
  const rows = await db.query.placeCategory.findMany({
    orderBy: (c, { asc: a }) => [a(c.order)],
  });
  return { success: true, data: rows };
}

// ─── Landmark Queries ────────────────────────────────────────────────────────

export async function getLandmarkPins() {
  const rows = await db.query.landmark.findMany({
    where: eq(landmark.status, "approved"),
    columns: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      category: true,
    },
    with: {
      placeCategory: {
        columns: { slug: true, color: true, icon: true },
      },
      photos: {
        columns: { url: true, source: true, order: true },
        orderBy: (p, { asc: a }) => [a(p.order)],
        limit: 1,
      },
    },
  });

  const now = new Date();
  const eventRows = await db.query.campusEvent.findMany({
    where: and(
      eq(campusEvent.status, "approved"),
      gte(campusEvent.endDate, now),
      isNotNull(campusEvent.locationId),
    ),
    columns: {
      id: true,
      title: true,
      locationId: true,
      coverImageKey: true,
      coverColor: true,
      startDate: true,
    },
    orderBy: (e, { asc: a }) => [a(e.startDate)],
  });

  // Group by locationId; array is startDate ASC so first entry = earliest upcoming event
  const bannerByLocationId = new Map<string, LandmarkBanner>();
  for (const ev of eventRows) {
    if (!ev.locationId || bannerByLocationId.has(ev.locationId)) continue;
    bannerByLocationId.set(ev.locationId, {
      type: "event",
      id: ev.id,
      title: ev.title,
      imageUrl: ev.coverImageKey ? toPhotoProxyUrl(ev.coverImageKey) : null,
      coverColor: ev.coverColor,
      startDate: ev.startDate.toISOString(),
    });
  }

  const data = rows.map((r) => {
    const firstPhoto = r.photos[0];
    let photoUrl: string | null = null;
    if (firstPhoto) {
      photoUrl =
        firstPhoto.source === "google_places"
          ? `/api/places-photo?ref=${encodeURIComponent(firstPhoto.url)}&maxwidth=200`
          : toPhotoProxyUrl(firstPhoto.url);
    }
    return {
      id: r.id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      category: r.category,
      categorySlug: r.placeCategory?.slug ?? null,
      categoryColor: r.placeCategory?.color ?? null,
      categoryIcon: r.placeCategory?.icon ?? null,
      photoUrl,
      banner: bannerByLocationId.get(r.id) ?? null,
    };
  });

  return { success: true as const, data };
}

export async function getApprovedLandmarks(): Promise<ActionResult<unknown[]>> {
  const rows = await db.query.landmark.findMany({
    where: eq(landmark.status, "approved"),
    with: {
      photos: true,
      placeCategory: {
        columns: { slug: true, color: true, icon: true, name: true },
      },
    },
    orderBy: (l, { desc }) => [desc(l.createdAt)],
  });

  const data = await Promise.all(
    rows.map(async (r) => {
      const photos = await Promise.all(
        r.photos
          .sort((a, b) => {
            if (a.source === b.source) return a.order - b.order;
            return a.source === "upload" ? -1 : 1;
          })
          .map(async (p) => ({
            ...p,
            createdAt: p.createdAt.toISOString(),
            resolvedUrl:
              p.source === "google_places"
                ? `/api/places-photo?ref=${encodeURIComponent(p.url)}`
                : toPhotoProxyUrl(p.url),
          })),
      );
      return {
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        categorySlug: r.placeCategory?.slug ?? null,
        categoryColor: r.placeCategory?.color ?? null,
        categoryIcon: r.placeCategory?.icon ?? null,
        categoryName: r.placeCategory?.name ?? null,
        photos,
      };
    }),
  );

  return { success: true, data };
}

export async function getLandmarkById(
  id: string,
): Promise<ActionResult<unknown>> {
  const session = await getOptionalSession();

  const row = await db.query.landmark.findFirst({
    where: eq(landmark.id, id),
    with: {
      placeCategory: {
        columns: { slug: true, color: true, icon: true, name: true },
      },
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

  const isOwner = row.userId ? session?.user.id === row.userId : false;
  const isAdmin = session?.user.role === "admin";
  if (row.status !== "approved" && !isOwner && !isAdmin) {
    return { success: false, error: "Landmark not found" };
  }

  const photos = await Promise.all(
    row.photos
      .sort((a, b) => {
        if (a.source === b.source) return a.order - b.order;
        return a.source === "upload" ? -1 : 1;
      })
      .map(async (p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        resolvedUrl:
          p.source === "google_places"
            ? `/api/places-photo?ref=${encodeURIComponent(p.url)}`
            : toPhotoProxyUrl(p.url),
      })),
  );

  return {
    success: true,
    data: {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      categorySlug: row.placeCategory?.slug ?? null,
      categoryColor: row.placeCategory?.color ?? null,
      categoryIcon: row.placeCategory?.icon ?? null,
      categoryName: row.placeCategory?.name ?? null,
      photos,
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

// ─── Create Landmark (User) ──────────────────────────────────────────────────

const createLandmarkInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  categoryId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  website: z.string().url().max(500).optional().or(z.literal("")),
  operatingHours: z.unknown().optional(),
  tags: z.array(z.string()).max(10).default([]),
  photos: z.array(z.object({
    url: z.string(),
    caption: z.string().optional(),
  })).max(5).default([]),
});

export async function createLandmark(
  input: z.infer<typeof createLandmarkInput>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createLandmarkInput.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Sign in to add a location" };

  const limited = await guardAction("landmark.create", {
    userId: session.user.id,
    contentBody: parsed.data.name + " " + parsed.data.description,
  });
  if (limited) return limited;

  // Verify category exists
  const cat = await db.query.placeCategory.findFirst({
    where: eq(placeCategory.id, parsed.data.categoryId),
    columns: { id: true, slug: true },
  });
  if (!cat) return { success: false, error: "Invalid category" };

  // Determine approval mode
  const approvalMode = await getApprovalMode();
  let status: "draft" | "approved" = "draft";

  if (approvalMode === "auto") {
    status = "approved";
  } else if (approvalMode === "ai") {
    const modResult = await moderateContent({
      type: "landmark",
      title: parsed.data.name,
      body: parsed.data.description,
    });
    status = modResult.approved ? "approved" : "draft";
  }

  const { photos, ...landmarkData } = parsed.data;

  const [created] = await db
    .insert(landmark)
    .values({
      name: landmarkData.name,
      description: landmarkData.description,
      category: cat.slug === "event-venue" ? "event" : cat.slug === "monument" ? "attraction" : "community",
      categoryId: landmarkData.categoryId,
      lat: landmarkData.lat,
      lng: landmarkData.lng,
      address: landmarkData.address ?? null,
      phone: landmarkData.phone ?? null,
      website: landmarkData.website || null,
      operatingHours: landmarkData.operatingHours ?? null,
      tags: landmarkData.tags,
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
        source: "upload",
        order: i,
      })),
    );
  }

  if (status === "draft") {
    const handle = session.user.username ? `@${session.user.username}` : session.user.name ?? "A user";
    await createNotification({
      type: "landmark_pending",
      targetId: created.id,
      targetTitle: landmarkData.name,
      authorHandle: handle,
    });
    await createUserNotification({
      userId: session.user.id,
      type: "landmark_pending",
      contentType: "landmark",
      targetId: created.id,
      targetTitle: landmarkData.name,
    });
  }

  return { success: true, data: { id: created.id } };
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

const createReviewInput = z.object({
  landmarkId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).optional(),
});

async function recalcRating(landmarkId: string) {
  const result = await db
    .select({
      avg: sql<number>`COALESCE(AVG(${landmarkReview.rating}), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(landmarkReview)
    .where(eq(landmarkReview.landmarkId, landmarkId));

  await db
    .update(landmark)
    .set({
      avgRating: Number(result[0].avg),
      reviewCount: Number(result[0].count),
    })
    .where(eq(landmark.id, landmarkId));
}

export async function createReview(
  input: z.infer<typeof createReviewInput>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createReviewInput.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Sign in to write a review" };

  const limited = await guardAction("landmark.review", {
    userId: session.user.id,
    contentBody: parsed.data.body,
  });
  if (limited) return limited;

  // Check landmark exists and is approved
  const lm = await db.query.landmark.findFirst({
    where: eq(landmark.id, parsed.data.landmarkId),
    columns: { id: true, status: true },
  });
  if (!lm || lm.status !== "approved")
    return { success: false, error: "Landmark not found" };

  // Check for existing review
  const existing = await db.query.landmarkReview.findFirst({
    where: and(
      eq(landmarkReview.landmarkId, parsed.data.landmarkId),
      eq(landmarkReview.userId, session.user.id),
    ),
    columns: { id: true },
  });
  if (existing)
    return { success: false, error: "You already reviewed this place" };

  const [review] = await db
    .insert(landmarkReview)
    .values({
      landmarkId: parsed.data.landmarkId,
      userId: session.user.id,
      rating: parsed.data.rating,
      body: parsed.data.body ?? null,
    })
    .returning({ id: landmarkReview.id });

  await recalcRating(parsed.data.landmarkId);

  return { success: true, data: { id: review.id } };
}

const updateReviewInput = z.object({
  reviewId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).optional(),
});

export async function updateReview(
  input: z.infer<typeof updateReviewInput>,
): Promise<ActionResult<void>> {
  const parsed = updateReviewInput.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Sign in required" };

  const existing = await db.query.landmarkReview.findFirst({
    where: eq(landmarkReview.id, parsed.data.reviewId),
    columns: { id: true, userId: true, landmarkId: true },
  });
  if (!existing) return { success: false, error: "Review not found" };
  if (existing.userId !== session.user.id)
    return { success: false, error: "Not your review" };

  await db
    .update(landmarkReview)
    .set({
      rating: parsed.data.rating,
      body: parsed.data.body ?? null,
    })
    .where(eq(landmarkReview.id, parsed.data.reviewId));

  await recalcRating(existing.landmarkId);
  return { success: true, data: undefined };
}

export async function deleteReview(
  reviewId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Sign in required" };

  const existing = await db.query.landmarkReview.findFirst({
    where: eq(landmarkReview.id, reviewId),
    columns: { id: true, userId: true, landmarkId: true },
  });
  if (!existing) return { success: false, error: "Review not found" };
  if (existing.userId !== session.user.id && session.user.role !== "admin")
    return { success: false, error: "Not authorized" };

  await db.delete(landmarkReview).where(eq(landmarkReview.id, reviewId));
  await recalcRating(existing.landmarkId);
  return { success: true, data: undefined };
}

// ─── Suggest Edit ────────────────────────────────────────────────────────────

const suggestEditInput = z.object({
  landmarkId: z.string().uuid(),
  changes: z.record(z.string(), z.unknown()),
  note: z.string().max(500).optional(),
});

export async function suggestLandmarkEdit(
  input: z.infer<typeof suggestEditInput>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = suggestEditInput.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Sign in required" };

  const limited = await guardAction("landmark.suggest_edit", {
    userId: session.user.id,
  });
  if (limited) return limited;

  // Verify landmark exists
  const lm = await db.query.landmark.findFirst({
    where: eq(landmark.id, parsed.data.landmarkId),
    columns: { id: true, name: true },
  });
  if (!lm) return { success: false, error: "Landmark not found" };

  if (Object.keys(parsed.data.changes).length === 0)
    return { success: false, error: "No changes provided" };

  const [edit] = await db
    .insert(landmarkEdit)
    .values({
      landmarkId: parsed.data.landmarkId,
      userId: session.user.id,
      changes: parsed.data.changes,
      note: parsed.data.note ?? null,
    })
    .returning({ id: landmarkEdit.id });

  const handle = session.user.username ? `@${session.user.username}` : session.user.name ?? "A user";
  await createNotification({
    type: "landmark_edit_suggested",
    targetId: lm.id,
    targetTitle: lm.name,
    authorHandle: handle,
  });

  return { success: true, data: { id: edit.id } };
}
