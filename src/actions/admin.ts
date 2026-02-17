"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
  communityPost,
  campusEvent,
  landmark,
  gigListing,
  landmarkPhoto,
  adminNotification,
  adminSetting,
  user,
} from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import {
  type ActionResult,
  type ApprovalMode,
  type ModerationPreset,
  requireAdmin,
  getAutoApproveSetting,
  getApprovalMode,
  getModerationPreset,
  getCustomModerationRules,
  createNotification,
  createUserNotification,
} from "./_helpers";
import { parseCompensation } from "@/lib/gigs";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const rejectSchema = z.object({
  reason: z.string().min(1),
});

const createPostSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  type: z.enum(["text", "link", "image"]),
  flair: z.string().min(1),
  locationId: z.string().uuid().optional(),
  linkUrl: z.string().optional(),
  imageColor: z.string().optional(),
  imageEmoji: z.string().optional(),
});

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(["academic", "cultural", "social", "sports", "org"]),
  organizer: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  locationId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  coverColor: z.string().default("#3b82f6"),
});

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
    .array(
      z.object({
        url: z.string(),
        caption: z.string().optional(),
        source: z.enum(["upload", "google_places"]).default("upload"),
        attribution: z.string().optional(),
      }),
    )
    .default([]),
});

const createGigSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  posterCollege: z.string().optional(),
  compensation: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  locationId: z.string().uuid().optional(),
  locationNote: z.string().optional(),
  deadline: z.string().optional(),
  urgency: z.enum(["flexible", "soon", "urgent"]).default("flexible"),
  contactMethod: z.string().min(1),
});

const settingsSchema = z.object({
  approvalMode: z.enum(["auto", "manual", "ai"]),
  moderationPreset: z.enum(["strict", "moderate", "relaxed"]).optional(),
  customModerationRules: z.string().max(2000).optional(),
});

// ─── Posts ─────────────────────────────────────────────────────────────────────

export async function adminGetAllPosts(
  status?: string,
): Promise<ActionResult<unknown[]>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const rows = await db.query.communityPost.findMany({
    where: status ? eq(communityPost.status, status) : undefined,
    with: {
      user: { columns: { name: true, username: true, image: true } },
    },
    orderBy: (p, { desc: d }) => [d(p.createdAt)],
  });

  return {
    success: true,
    data: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      author: r.user.name,
      authorHandle: r.user.username ? `@${r.user.username}` : null,
      authorImage: r.user.image,
    })),
  };
}

export async function adminApprovePost(
  id: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const [post] = await db
    .update(communityPost)
    .set({ status: "approved", rejectionReason: null })
    .where(eq(communityPost.id, id))
    .returning({ title: communityPost.title, userId: communityPost.userId });

  if (!post) return { success: false, error: "Post not found" };

  const postUser = await db.query.user.findFirst({
    where: eq(user.id, post.userId),
    columns: { username: true, name: true },
  });

  await createNotification({
    type: "post_approved",
    targetId: id,
    targetTitle: post.title,
    authorHandle: postUser?.username ?? postUser?.name ?? "unknown",
  });

  await createUserNotification({
    userId: post.userId,
    type: "post_approved",
    contentType: "post",
    targetId: id,
    targetTitle: post.title,
  });

  return { success: true, data: undefined };
}

export async function adminRejectPost(
  id: string,
  reason: string,
): Promise<ActionResult<void>> {
  const parsed = rejectSchema.safeParse({ reason });
  if (!parsed.success)
    return { success: false, error: "Reason is required" };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const [post] = await db
    .update(communityPost)
    .set({ status: "rejected", rejectionReason: parsed.data.reason })
    .where(eq(communityPost.id, id))
    .returning({ title: communityPost.title, userId: communityPost.userId });

  if (!post) return { success: false, error: "Post not found" };

  const postUser = await db.query.user.findFirst({
    where: eq(user.id, post.userId),
    columns: { username: true, name: true },
  });

  await createNotification({
    type: "post_rejected",
    targetId: id,
    targetTitle: post.title,
    authorHandle: postUser?.username ?? postUser?.name ?? "unknown",
    reason: parsed.data.reason,
  });

  await createUserNotification({
    userId: post.userId,
    type: "post_rejected",
    contentType: "post",
    targetId: id,
    targetTitle: post.title,
    reason: parsed.data.reason,
  });

  return { success: true, data: undefined };
}

export async function adminDeletePost(
  id: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  await db.delete(communityPost).where(eq(communityPost.id, id));
  return { success: true, data: undefined };
}

export async function adminCreatePost(
  input: z.infer<typeof createPostSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const autoApprove = await getAutoApproveSetting();
  const [created] = await db
    .insert(communityPost)
    .values({
      ...parsed.data,
      locationId: parsed.data.locationId ?? null,
      linkUrl: parsed.data.linkUrl ?? null,
      imageColor: parsed.data.imageColor ?? null,
      imageEmoji: parsed.data.imageEmoji ?? null,
      status: autoApprove ? "approved" : "draft",
      userId: session.user.id,
    })
    .returning({ id: communityPost.id });

  return { success: true, data: { id: created.id } };
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function adminGetAllEvents(
  status?: string,
): Promise<ActionResult<unknown[]>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const rows = await db.query.campusEvent.findMany({
    where: status ? eq(campusEvent.status, status) : undefined,
    with: {
      user: { columns: { name: true, username: true, image: true } },
    },
    orderBy: (e, { desc: d }) => [d(e.createdAt)],
  });

  return {
    success: true,
    data: rows.map((r) => ({
      ...r,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      author: r.user.name,
      authorHandle: r.user.username ? `@${r.user.username}` : null,
      authorImage: r.user.image,
    })),
  };
}

export async function adminApproveEvent(
  id: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const [event] = await db
    .update(campusEvent)
    .set({ status: "approved", rejectionReason: null })
    .where(eq(campusEvent.id, id))
    .returning({
      title: campusEvent.title,
      userId: campusEvent.userId,
    });

  if (!event) return { success: false, error: "Event not found" };

  const eventUser = await db.query.user.findFirst({
    where: eq(user.id, event.userId),
    columns: { username: true, name: true },
  });

  await createNotification({
    type: "event_approved",
    targetId: id,
    targetTitle: event.title,
    authorHandle: eventUser?.username ?? eventUser?.name ?? "unknown",
  });

  await createUserNotification({
    userId: event.userId,
    type: "event_approved",
    contentType: "event",
    targetId: id,
    targetTitle: event.title,
  });

  return { success: true, data: undefined };
}

export async function adminRejectEvent(
  id: string,
  reason: string,
): Promise<ActionResult<void>> {
  const parsed = rejectSchema.safeParse({ reason });
  if (!parsed.success)
    return { success: false, error: "Reason is required" };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const [event] = await db
    .update(campusEvent)
    .set({ status: "rejected", rejectionReason: parsed.data.reason })
    .where(eq(campusEvent.id, id))
    .returning({
      title: campusEvent.title,
      userId: campusEvent.userId,
    });

  if (!event) return { success: false, error: "Event not found" };

  const eventUser = await db.query.user.findFirst({
    where: eq(user.id, event.userId),
    columns: { username: true, name: true },
  });

  await createNotification({
    type: "event_rejected",
    targetId: id,
    targetTitle: event.title,
    authorHandle: eventUser?.username ?? eventUser?.name ?? "unknown",
    reason: parsed.data.reason,
  });

  await createUserNotification({
    userId: event.userId,
    type: "event_rejected",
    contentType: "event",
    targetId: id,
    targetTitle: event.title,
    reason: parsed.data.reason,
  });

  return { success: true, data: undefined };
}

export async function adminDeleteEvent(
  id: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  await db.delete(campusEvent).where(eq(campusEvent.id, id));
  return { success: true, data: undefined };
}

export async function adminCreateEvent(
  input: z.infer<typeof createEventSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const autoApprove = await getAutoApproveSetting();
  const [created] = await db
    .insert(campusEvent)
    .values({
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      organizer: parsed.data.organizer,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      locationId: parsed.data.locationId ?? null,
      tags: parsed.data.tags,
      coverColor: parsed.data.coverColor,
      status: autoApprove ? "approved" : "draft",
      userId: session.user.id,
    })
    .returning({ id: campusEvent.id });

  return { success: true, data: { id: created.id } };
}

// ─── Landmarks ────────────────────────────────────────────────────────────────

export async function adminGetAllLandmarks(
  status?: string,
): Promise<ActionResult<unknown[]>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const rows = await db.query.landmark.findMany({
    where: status ? eq(landmark.status, status) : undefined,
    with: {
      user: { columns: { name: true, username: true, image: true } },
      photos: true,
    },
    orderBy: (l, { desc: d }) => [d(l.createdAt)],
  });

  return {
    success: true,
    data: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      author: r.user?.name ?? null,
      authorHandle: r.user?.username ? `@${r.user.username}` : null,
      authorImage: r.user?.image ?? null,
      photos: r.photos.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
    })),
  };
}

export async function adminApproveLandmark(
  id: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const [lm] = await db
    .update(landmark)
    .set({ status: "approved", rejectionReason: null })
    .where(eq(landmark.id, id))
    .returning({
      name: landmark.name,
      userId: landmark.userId,
    });

  if (!lm) return { success: false, error: "Landmark not found" };

  if (lm.userId) {
    const lmUser = await db.query.user.findFirst({
      where: eq(user.id, lm.userId),
      columns: { username: true, name: true },
    });

    await createNotification({
      type: "landmark_approved",
      targetId: id,
      targetTitle: lm.name,
      authorHandle: lmUser?.username ?? lmUser?.name ?? "unknown",
    });

    await createUserNotification({
      userId: lm.userId,
      type: "landmark_approved",
      contentType: "landmark",
      targetId: id,
      targetTitle: lm.name,
    });
  }

  return { success: true, data: undefined };
}

export async function adminRejectLandmark(
  id: string,
  reason: string,
): Promise<ActionResult<void>> {
  const parsed = rejectSchema.safeParse({ reason });
  if (!parsed.success)
    return { success: false, error: "Reason is required" };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const [lm] = await db
    .update(landmark)
    .set({ status: "rejected", rejectionReason: parsed.data.reason })
    .where(eq(landmark.id, id))
    .returning({
      name: landmark.name,
      userId: landmark.userId,
    });

  if (!lm) return { success: false, error: "Landmark not found" };

  if (lm.userId) {
    const lmUser = await db.query.user.findFirst({
      where: eq(user.id, lm.userId),
      columns: { username: true, name: true },
    });

    await createNotification({
      type: "landmark_rejected",
      targetId: id,
      targetTitle: lm.name,
      authorHandle: lmUser?.username ?? lmUser?.name ?? "unknown",
      reason: parsed.data.reason,
    });

    await createUserNotification({
      userId: lm.userId,
      type: "landmark_rejected",
      contentType: "landmark",
      targetId: id,
      targetTitle: lm.name,
      reason: parsed.data.reason,
    });
  }

  return { success: true, data: undefined };
}

export async function adminDeleteLandmark(
  id: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  await db.delete(landmark).where(eq(landmark.id, id));
  return { success: true, data: undefined };
}

export async function adminCreateLandmark(
  input: z.infer<typeof createLandmarkSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createLandmarkSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const autoApprove = await getAutoApproveSetting();
  const { photos, ...landmarkData } = parsed.data;

  const [created] = await db
    .insert(landmark)
    .values({
      ...landmarkData,
      operatingHours: landmarkData.operatingHours ?? null,
      status: autoApprove ? "approved" : "draft",
      userId: session.user.id,
    })
    .returning({ id: landmark.id });

  if (photos.length > 0) {
    await db.insert(landmarkPhoto).values(
      photos.map((p, i) => ({
        landmarkId: created.id,
        url: p.url,
        caption: p.caption ?? null,
        source: p.source ?? "upload",
        attribution: p.attribution ?? null,
        order: i,
      })),
    );
  }

  return { success: true, data: { id: created.id } };
}

// ─── Gigs ─────────────────────────────────────────────────────────────────────

export async function adminGetAllGigs(
  status?: string,
): Promise<ActionResult<unknown[]>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const rows = await db.query.gigListing.findMany({
    where: status ? eq(gigListing.status, status) : undefined,
    with: {
      user: { columns: { name: true, username: true, image: true } },
    },
    orderBy: (g, { desc: d }) => [d(g.createdAt)],
  });

  return {
    success: true,
    data: rows.map((r) => ({
      ...r,
      deadline: r.deadline?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      author: r.user.name,
      authorHandle: r.user.username ? `@${r.user.username}` : null,
      authorImage: r.user.image,
    })),
  };
}

export async function adminApproveGig(
  id: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const [gig] = await db
    .update(gigListing)
    .set({ status: "approved", rejectionReason: null })
    .where(eq(gigListing.id, id))
    .returning({
      title: gigListing.title,
      userId: gigListing.userId,
    });

  if (!gig) return { success: false, error: "Gig not found" };

  const gigUser = await db.query.user.findFirst({
    where: eq(user.id, gig.userId),
    columns: { username: true, name: true },
  });

  await createNotification({
    type: "gig_approved",
    targetId: id,
    targetTitle: gig.title,
    authorHandle: gigUser?.username ?? gigUser?.name ?? "unknown",
  });

  await createUserNotification({
    userId: gig.userId,
    type: "gig_approved",
    contentType: "gig",
    targetId: id,
    targetTitle: gig.title,
  });

  return { success: true, data: undefined };
}

export async function adminRejectGig(
  id: string,
  reason: string,
): Promise<ActionResult<void>> {
  const parsed = rejectSchema.safeParse({ reason });
  if (!parsed.success)
    return { success: false, error: "Reason is required" };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const [gig] = await db
    .update(gigListing)
    .set({ status: "rejected", rejectionReason: parsed.data.reason })
    .where(eq(gigListing.id, id))
    .returning({
      title: gigListing.title,
      userId: gigListing.userId,
    });

  if (!gig) return { success: false, error: "Gig not found" };

  const gigUser = await db.query.user.findFirst({
    where: eq(user.id, gig.userId),
    columns: { username: true, name: true },
  });

  await createNotification({
    type: "gig_rejected",
    targetId: id,
    targetTitle: gig.title,
    authorHandle: gigUser?.username ?? gigUser?.name ?? "unknown",
    reason: parsed.data.reason,
  });

  await createUserNotification({
    userId: gig.userId,
    type: "gig_rejected",
    contentType: "gig",
    targetId: id,
    targetTitle: gig.title,
    reason: parsed.data.reason,
  });

  return { success: true, data: undefined };
}

export async function adminDeleteGig(
  id: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  await db.delete(gigListing).where(eq(gigListing.id, id));
  return { success: true, data: undefined };
}

export async function adminCreateGig(
  input: z.infer<typeof createGigSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createGigSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const autoApprove = await getAutoApproveSetting();
  const { value: compensationValue, isPaid } = parseCompensation(parsed.data.compensation);

  const [created] = await db
    .insert(gigListing)
    .values({
      title: parsed.data.title,
      description: parsed.data.description,
      posterCollege: parsed.data.posterCollege ?? null,
      compensation: parsed.data.compensation,
      compensationValue,
      isPaid,
      category: parsed.data.category,
      tags: parsed.data.tags,
      locationId: parsed.data.locationId ?? null,
      locationNote: parsed.data.locationNote ?? null,
      deadline: parsed.data.deadline
        ? new Date(parsed.data.deadline)
        : null,
      urgency: parsed.data.urgency,
      contactMethod: parsed.data.contactMethod,
      status: autoApprove ? "approved" : "draft",
      userId: session.user.id,
    })
    .returning({ id: gigListing.id });

  return { success: true, data: { id: created.id } };
}

// ─── Dashboard + System ───────────────────────────────────────────────────────

export async function adminGetDashboardStats(): Promise<
  ActionResult<{
    posts: Record<string, number>;
    events: Record<string, number>;
    landmarks: Record<string, number>;
    gigs: Record<string, number>;
    notifications: { total: number; unread: number };
  }>
> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const [postStats] = await db
    .select({
      draft: sql<number>`COUNT(*) FILTER (WHERE ${communityPost.status} = 'draft')`,
      approved: sql<number>`COUNT(*) FILTER (WHERE ${communityPost.status} = 'approved')`,
      rejected: sql<number>`COUNT(*) FILTER (WHERE ${communityPost.status} = 'rejected')`,
      total: sql<number>`COUNT(*)`,
    })
    .from(communityPost);

  const [eventStats] = await db
    .select({
      draft: sql<number>`COUNT(*) FILTER (WHERE ${campusEvent.status} = 'draft')`,
      approved: sql<number>`COUNT(*) FILTER (WHERE ${campusEvent.status} = 'approved')`,
      rejected: sql<number>`COUNT(*) FILTER (WHERE ${campusEvent.status} = 'rejected')`,
      total: sql<number>`COUNT(*)`,
    })
    .from(campusEvent);

  const [landmarkStats] = await db
    .select({
      draft: sql<number>`COUNT(*) FILTER (WHERE ${landmark.status} = 'draft')`,
      approved: sql<number>`COUNT(*) FILTER (WHERE ${landmark.status} = 'approved')`,
      rejected: sql<number>`COUNT(*) FILTER (WHERE ${landmark.status} = 'rejected')`,
      total: sql<number>`COUNT(*)`,
    })
    .from(landmark);

  const [gigStats] = await db
    .select({
      draft: sql<number>`COUNT(*) FILTER (WHERE ${gigListing.status} = 'draft')`,
      approved: sql<number>`COUNT(*) FILTER (WHERE ${gigListing.status} = 'approved')`,
      rejected: sql<number>`COUNT(*) FILTER (WHERE ${gigListing.status} = 'rejected')`,
      total: sql<number>`COUNT(*)`,
    })
    .from(gigListing);

  const [notifStats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      unread: sql<number>`COUNT(*) FILTER (WHERE ${adminNotification.readByAdmin} = false)`,
    })
    .from(adminNotification);

  return {
    success: true,
    data: {
      posts: {
        draft: Number(postStats.draft),
        approved: Number(postStats.approved),
        rejected: Number(postStats.rejected),
        total: Number(postStats.total),
      },
      events: {
        draft: Number(eventStats.draft),
        approved: Number(eventStats.approved),
        rejected: Number(eventStats.rejected),
        total: Number(eventStats.total),
      },
      landmarks: {
        draft: Number(landmarkStats.draft),
        approved: Number(landmarkStats.approved),
        rejected: Number(landmarkStats.rejected),
        total: Number(landmarkStats.total),
      },
      gigs: {
        draft: Number(gigStats.draft),
        approved: Number(gigStats.approved),
        rejected: Number(gigStats.rejected),
        total: Number(gigStats.total),
      },
      notifications: {
        total: Number(notifStats.total),
        unread: Number(notifStats.unread),
      },
    },
  };
}

export async function adminGetNotifications(): Promise<
  ActionResult<unknown[]>
> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const rows = await db.query.adminNotification.findMany({
    orderBy: (n, { desc: d }) => [d(n.createdAt)],
  });

  return {
    success: true,
    data: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function adminMarkAllNotificationsRead(): Promise<
  ActionResult<void>
> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  await db
    .update(adminNotification)
    .set({ readByAdmin: true })
    .where(eq(adminNotification.readByAdmin, false));

  return { success: true, data: undefined };
}

export async function adminGetSettings(): Promise<
  ActionResult<{
    approvalMode: ApprovalMode;
    moderationPreset: ModerationPreset;
    customModerationRules: string;
  }>
> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const approvalMode = await getApprovalMode();
  const moderationPreset = await getModerationPreset();
  const customModerationRules = await getCustomModerationRules();
  return { success: true, data: { approvalMode, moderationPreset, customModerationRules } };
}

export async function adminUpdateSettings(
  input: z.infer<typeof settingsSchema>,
): Promise<ActionResult<void>> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  await db
    .insert(adminSetting)
    .values({
      key: "approvalMode",
      value: parsed.data.approvalMode,
    })
    .onConflictDoUpdate({
      target: [adminSetting.key],
      set: { value: parsed.data.approvalMode },
    });

  if (parsed.data.moderationPreset !== undefined) {
    await db
      .insert(adminSetting)
      .values({
        key: "moderationPreset",
        value: parsed.data.moderationPreset,
      })
      .onConflictDoUpdate({
        target: [adminSetting.key],
        set: { value: parsed.data.moderationPreset },
      });
  }

  if (parsed.data.customModerationRules !== undefined) {
    await db
      .insert(adminSetting)
      .values({
        key: "customModerationRules",
        value: parsed.data.customModerationRules,
      })
      .onConflictDoUpdate({
        target: [adminSetting.key],
        set: { value: parsed.data.customModerationRules },
      });
  }

  return { success: true, data: undefined };
}
