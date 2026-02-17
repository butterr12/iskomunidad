"use server";

import { db } from "@/lib/db";
import { landmark } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  type ActionResult,
  getOptionalSession,
} from "./_helpers";

function toPhotoProxyUrl(key: string): string {
  return `/api/photos/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getLandmarkPins() {
  const rows = await db
    .select({
      id: landmark.id,
      name: landmark.name,
      lat: landmark.lat,
      lng: landmark.lng,
      category: landmark.category,
    })
    .from(landmark)
    .where(eq(landmark.status, "approved"));

  return { success: true as const, data: rows };
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
