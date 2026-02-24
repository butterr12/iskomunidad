"use server";

import { db } from "@/lib/db";
import { landmark, campusEvent } from "@/lib/schema";
import { eq, and, gte, isNotNull } from "drizzle-orm";
import {
  type ActionResult,
  getOptionalSession,
} from "./_helpers";
import type { LandmarkBanner } from "@/lib/landmarks";

function toPhotoProxyUrl(key: string): string {
  return `/api/photos/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

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
      photos: {
        columns: { url: true, source: true, order: true },
        orderBy: (p, { asc }) => [asc(p.order)],
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
    orderBy: (e, { asc }) => [asc(e.startDate)],
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
      photoUrl,
      banner: bannerByLocationId.get(r.id) ?? null,
    };
  });

  return { success: true as const, data };
}

export async function getApprovedLandmarks(): Promise<ActionResult<unknown[]>> {
  const rows = await db.query.landmark.findMany({
    where: eq(landmark.status, "approved"),
    with: { photos: true },
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
