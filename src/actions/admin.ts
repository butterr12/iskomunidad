"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
  communityPost,
  postImage,
  campusEvent,
  landmark,
  gigListing,
  landmarkPhoto,
  adminNotification,
  adminSetting,
  cmBan,
  cmMessage,
  cmQueueEntry,
  cmReport,
  cmSession,
  cmSessionParticipant,
  user,
  session as authSession,
  message,
  eventRsvp,
  abuseEvent,
} from "@/lib/schema";
import { and, eq, sql, desc, gte, gt, inArray, isNull, ne } from "drizzle-orm";
import {
  type ActionResult,
  type ApprovalMode,
  type ModerationPreset,
  requireAdmin,
  getAutoApproveSetting,
  getApprovalMode,
  getCampusMatchEnabled,
  getModerationPreset,
  getCustomModerationRules,
  getCursorPromoEnabled,
  getMatchDailySwipeLimit,
  createNotification,
  createUserNotification,
} from "./_helpers";
import { parseCompensation } from "@/lib/gigs";
import { isoDateString } from "@/lib/validation/date";
import { safeLinkUrl } from "@/lib/validation/url";
import {
  grantFlair,
  revokeFlair,
  getUserFlairsFromDb,
} from "@/lib/flair-service";
import { getFlairById } from "@/lib/user-flairs";
import { extractMentionUsernames } from "@/lib/mentions";
import { getIO } from "@/lib/socket-server";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const rejectSchema = z.object({
  reason: z.string().min(1),
});

const createPostSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  flair: z.string().min(1),
  locationId: z.string().uuid().optional(),
  linkUrl: safeLinkUrl,
  imageKeys: z.array(z.string()).max(4).optional(),
});

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(["academic", "cultural", "social", "sports", "org"]),
  organizer: z.string().min(1),
  startDate: isoDateString,
  endDate: isoDateString,
  locationId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  coverColor: z.string().default("#3b82f6"),
}).refine(
  (data) => new Date(data.endDate).getTime() >= new Date(data.startDate).getTime(),
  { message: "End date must be on or after start date", path: ["endDate"] },
);

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
  deadline: isoDateString.optional(),
  urgency: z.enum(["flexible", "soon", "urgent"]).default("flexible"),
  contactMethod: z.string().min(1),
});

const settingsSchema = z.object({
  approvalMode: z.enum(["auto", "manual", "ai"]).optional(),
  moderationPreset: z.enum(["strict", "moderate", "relaxed"]).optional(),
  customModerationRules: z.string().max(2000).optional(),
  cursorPromoEnabled: z.boolean().optional(),
  campusMatchEnabled: z.boolean().optional(),
  matchDailySwipeLimit: z.number().int().min(1).max(100).optional(),
});

const resolveCampusMatchReportSchema = z.object({
  reportId: z.string().uuid(),
  adminNote: z.string().trim().max(1000).optional(),
});

const banCampusMatchReportSchema = z.object({
  reportId: z.string().uuid(),
  durationDays: z.number().int().min(1).max(365).default(7),
  adminNote: z.string().trim().max(1000).optional(),
});

const liftCampusMatchBanSchema = z.object({
  banId: z.string().uuid(),
});

function getActorLabel(actor?: { username?: string | null; name?: string | null } | null): string {
  return actor?.username ? `@${actor.username}` : (actor?.name ?? "Someone");
}

function emitCampusMatchUserEvent(
  eventName:
    | "campus_match_state_changed"
    | "campus_match_session_ended",
  payload: Record<string, unknown>,
  userIds: string[],
) {
  try {
    const io = getIO();
    const uniq = [...new Set(userIds)];
    for (const userId of uniq) {
      io.to(`user:${userId}`).emit(eventName, payload);
    }
  } catch (err) {
    console.error("[admin] socket emit failed", { eventName, err });
  }
}

async function notifyPostMentionsOnApproval(data: {
  postId: string;
  postTitle: string;
  postBody?: string | null;
  postAuthorId: string;
  postAuthorLabel: string;
}) {
  const usernames = extractMentionUsernames(
    `${data.postTitle}\n${data.postBody ?? ""}`,
  );
  if (usernames.length === 0) return;

  const mentionTargets = await db
    .select({ id: user.id, username: user.username })
    .from(user)
    .where(
      and(
        inArray(user.username, usernames),
        eq(user.status, "active"),
        ne(user.id, data.postAuthorId),
      ),
    );

  for (const target of mentionTargets) {
    await createUserNotification({
      userId: target.id,
      type: "post_mentioned",
      contentType: "post",
      targetId: data.postId,
      targetTitle: data.postTitle,
      actor: data.postAuthorLabel,
    });
  }
}

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

  const [existing] = await db
    .select({ status: communityPost.status })
    .from(communityPost)
    .where(eq(communityPost.id, id));
  if (!existing) return { success: false, error: "Post not found" };
  if (existing.status !== "draft")
    return { success: false, error: "Post is no longer pending" };

  const [post] = await db
    .update(communityPost)
    .set({ status: "approved", rejectionReason: null })
    .where(and(eq(communityPost.id, id), eq(communityPost.status, "draft")))
    .returning({
      title: communityPost.title,
      body: communityPost.body,
      userId: communityPost.userId,
    });

  if (!post) return { success: false, error: "Post was modified by another admin" };

  try {
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

    await notifyPostMentionsOnApproval({
      postId: id,
      postTitle: post.title,
      postBody: post.body,
      postAuthorId: post.userId,
      postAuthorLabel: getActorLabel(postUser),
    });
  } catch (err) {
    console.error("Failed to send approval notifications for post", id, err);
  }

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

  const [existing] = await db
    .select({ status: communityPost.status })
    .from(communityPost)
    .where(eq(communityPost.id, id));
  if (!existing) return { success: false, error: "Post not found" };
  if (existing.status !== "draft")
    return { success: false, error: "Post is no longer pending" };

  const [post] = await db
    .update(communityPost)
    .set({ status: "rejected", rejectionReason: parsed.data.reason })
    .where(and(eq(communityPost.id, id), eq(communityPost.status, "draft")))
    .returning({ title: communityPost.title, userId: communityPost.userId });

  if (!post) return { success: false, error: "Post was modified by another admin" };

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
  const { imageKeys, ...postData } = parsed.data;
  const [created] = await db
    .insert(communityPost)
    .values({
      ...postData,
      type: "text",
      locationId: postData.locationId ?? null,
      linkUrl: postData.linkUrl ?? null,
      status: autoApprove ? "approved" : "draft",
      userId: session.user.id,
    })
    .returning({ id: communityPost.id });

  if (imageKeys && imageKeys.length > 0) {
    await db.insert(postImage).values(
      imageKeys.map((key, i) => ({
        postId: created.id,
        imageKey: key,
        order: i,
      })),
    );
  }

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

  const [existing] = await db
    .select({ status: campusEvent.status })
    .from(campusEvent)
    .where(eq(campusEvent.id, id));
  if (!existing) return { success: false, error: "Event not found" };
  if (existing.status !== "draft")
    return { success: false, error: "Event is no longer pending" };

  const [event] = await db
    .update(campusEvent)
    .set({ status: "approved", rejectionReason: null })
    .where(and(eq(campusEvent.id, id), eq(campusEvent.status, "draft")))
    .returning({
      title: campusEvent.title,
      userId: campusEvent.userId,
    });

  if (!event) return { success: false, error: "Event was modified by another admin" };

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

  const [existing] = await db
    .select({ status: campusEvent.status })
    .from(campusEvent)
    .where(eq(campusEvent.id, id));
  if (!existing) return { success: false, error: "Event not found" };
  if (existing.status !== "draft")
    return { success: false, error: "Event is no longer pending" };

  const [event] = await db
    .update(campusEvent)
    .set({ status: "rejected", rejectionReason: parsed.data.reason })
    .where(and(eq(campusEvent.id, id), eq(campusEvent.status, "draft")))
    .returning({
      title: campusEvent.title,
      userId: campusEvent.userId,
    });

  if (!event) return { success: false, error: "Event was modified by another admin" };

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

  const [existing] = await db
    .select({ status: landmark.status })
    .from(landmark)
    .where(eq(landmark.id, id));
  if (!existing) return { success: false, error: "Landmark not found" };
  if (existing.status !== "draft")
    return { success: false, error: "Landmark is no longer pending" };

  const [lm] = await db
    .update(landmark)
    .set({ status: "approved", rejectionReason: null })
    .where(and(eq(landmark.id, id), eq(landmark.status, "draft")))
    .returning({
      name: landmark.name,
      userId: landmark.userId,
    });

  if (!lm)
    return { success: false, error: "Landmark was modified by another admin" };

  try {
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
  } catch (err) {
    console.error(
      "Failed to send approval notifications for landmark",
      id,
      err,
    );
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

  const [existing] = await db
    .select({ status: landmark.status })
    .from(landmark)
    .where(eq(landmark.id, id));
  if (!existing) return { success: false, error: "Landmark not found" };
  if (existing.status !== "draft")
    return { success: false, error: "Landmark is no longer pending" };

  const [lm] = await db
    .update(landmark)
    .set({ status: "rejected", rejectionReason: parsed.data.reason })
    .where(and(eq(landmark.id, id), eq(landmark.status, "draft")))
    .returning({
      name: landmark.name,
      userId: landmark.userId,
    });

  if (!lm)
    return { success: false, error: "Landmark was modified by another admin" };

  try {
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
  } catch (err) {
    console.error(
      "Failed to send rejection notifications for landmark",
      id,
      err,
    );
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

// ─── Bulk Landmark Actions ─────────────────────────────────────────────────────
// TODO: Apply the same bulk action pattern to posts, events, gigs, and users
//       in future admin panel iterations.

const bulkIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export async function adminBulkDeleteLandmarks(
  ids: string[],
): Promise<ActionResult<{ count: number }>> {
  const parsed = bulkIdsSchema.safeParse({ ids });
  if (!parsed.success) return { success: false, error: "Invalid IDs" };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const result = await db
    .delete(landmark)
    .where(inArray(landmark.id, parsed.data.ids))
    .returning({ id: landmark.id });

  return { success: true, data: { count: result.length } };
}

export async function adminBulkApproveLandmarks(
  ids: string[],
): Promise<ActionResult<{ count: number }>> {
  const parsed = bulkIdsSchema.safeParse({ ids });
  if (!parsed.success) return { success: false, error: "Invalid IDs" };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const updated = await db
    .update(landmark)
    .set({ status: "approved", rejectionReason: null })
    .where(
      and(inArray(landmark.id, parsed.data.ids), eq(landmark.status, "draft")),
    )
    .returning({ id: landmark.id, name: landmark.name, userId: landmark.userId });

  for (const lm of updated) {
    try {
      if (lm.userId) {
        const lmUser = await db.query.user.findFirst({
          where: eq(user.id, lm.userId),
          columns: { username: true, name: true },
        });

        await createNotification({
          type: "landmark_approved",
          targetId: lm.id,
          targetTitle: lm.name,
          authorHandle: lmUser?.username ?? lmUser?.name ?? "unknown",
        });

        await createUserNotification({
          userId: lm.userId,
          type: "landmark_approved",
          contentType: "landmark",
          targetId: lm.id,
          targetTitle: lm.name,
        });
      }
    } catch (err) {
      console.error(
        "Failed to send approval notification for landmark",
        lm.id,
        err,
      );
    }
  }

  return { success: true, data: { count: updated.length } };
}

export async function adminBulkRejectLandmarks(
  ids: string[],
  reason: string,
): Promise<ActionResult<{ count: number }>> {
  const parsed = bulkIdsSchema.safeParse({ ids });
  if (!parsed.success) return { success: false, error: "Invalid IDs" };

  const reasonParsed = rejectSchema.safeParse({ reason });
  if (!reasonParsed.success) return { success: false, error: "Reason is required" };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const updated = await db
    .update(landmark)
    .set({ status: "rejected", rejectionReason: reasonParsed.data.reason })
    .where(
      and(inArray(landmark.id, parsed.data.ids), eq(landmark.status, "draft")),
    )
    .returning({ id: landmark.id, name: landmark.name, userId: landmark.userId });

  for (const lm of updated) {
    try {
      if (lm.userId) {
        const lmUser = await db.query.user.findFirst({
          where: eq(user.id, lm.userId),
          columns: { username: true, name: true },
        });

        await createNotification({
          type: "landmark_rejected",
          targetId: lm.id,
          targetTitle: lm.name,
          authorHandle: lmUser?.username ?? lmUser?.name ?? "unknown",
          reason: reasonParsed.data.reason,
        });

        await createUserNotification({
          userId: lm.userId,
          type: "landmark_rejected",
          contentType: "landmark",
          targetId: lm.id,
          targetTitle: lm.name,
          reason: reasonParsed.data.reason,
        });
      }
    } catch (err) {
      console.error(
        "Failed to send rejection notification for landmark",
        lm.id,
        err,
      );
    }
  }

  return { success: true, data: { count: updated.length } };
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

  const [existing] = await db
    .select({ status: gigListing.status })
    .from(gigListing)
    .where(eq(gigListing.id, id));
  if (!existing) return { success: false, error: "Gig not found" };
  if (existing.status !== "draft")
    return { success: false, error: "Gig is no longer pending" };

  const [gig] = await db
    .update(gigListing)
    .set({ status: "approved", rejectionReason: null })
    .where(and(eq(gigListing.id, id), eq(gigListing.status, "draft")))
    .returning({
      title: gigListing.title,
      userId: gigListing.userId,
    });

  if (!gig) return { success: false, error: "Gig was modified by another admin" };

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

  const [existing] = await db
    .select({ status: gigListing.status })
    .from(gigListing)
    .where(eq(gigListing.id, id));
  if (!existing) return { success: false, error: "Gig not found" };
  if (existing.status !== "draft")
    return { success: false, error: "Gig is no longer pending" };

  const [gig] = await db
    .update(gigListing)
    .set({ status: "rejected", rejectionReason: parsed.data.reason })
    .where(and(eq(gigListing.id, id), eq(gigListing.status, "draft")))
    .returning({
      title: gigListing.title,
      userId: gigListing.userId,
    });

  if (!gig) return { success: false, error: "Gig was modified by another admin" };

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

// ─── Dashboard Data (Full) ───────────────────────────────────────────────────

type ActivityItem = {
  type: "new_user" | "new_post" | "new_event" | "abuse" | "cm_report";
  title: string;
  detail: string;
  timestamp: string;
};

type DashboardData = {
  kpis: {
    totalUsers: number;
    newUsersThisWeek: number;
    totalContent: number;
    pendingModeration: number;
    activeAbuseAlerts: number;
    pendingCmReports: number;
  };
  recentActivity: ActivityItem[];
  userGrowth: { date: string; count: number }[];
  contentHealth: {
    posts: { draft: number; approved: number; rejected: number };
    events: { draft: number; approved: number; rejected: number };
    gigs: { draft: number; approved: number; rejected: number };
    landmarks: { draft: number; approved: number; rejected: number };
  };
  engagement: {
    messagesSent: number;
    campusMatchSessions: number;
    eventRsvps: number;
  };
};

export async function adminGetDashboardData(): Promise<ActionResult<DashboardData>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    userStats,
    postCounts,
    eventCounts,
    gigCounts,
    landmarkCounts,
    abuseAlertCount,
    cmReportCount,
    userGrowthRaw,
    messagesCount,
    cmSessionCount,
    rsvpCount,
    recentUsers,
    recentPosts,
    recentEvents,
    recentAbuse,
    recentCmReports,
  ] = await Promise.all([
    // KPI: user stats
    db
      .select({
        total: sql<number>`COUNT(*) FILTER (WHERE ${user.status} != 'deleted')`,
        newThisWeek: sql<number>`COUNT(*) FILTER (WHERE ${user.createdAt} >= ${sevenDaysAgo} AND ${user.status} != 'deleted')`,
      })
      .from(user),
    // Content counts: posts
    db
      .select({
        draft: sql<number>`COUNT(*) FILTER (WHERE ${communityPost.status} = 'draft')`,
        approved: sql<number>`COUNT(*) FILTER (WHERE ${communityPost.status} = 'approved')`,
        rejected: sql<number>`COUNT(*) FILTER (WHERE ${communityPost.status} = 'rejected')`,
      })
      .from(communityPost),
    // Content counts: events
    db
      .select({
        draft: sql<number>`COUNT(*) FILTER (WHERE ${campusEvent.status} = 'draft')`,
        approved: sql<number>`COUNT(*) FILTER (WHERE ${campusEvent.status} = 'approved')`,
        rejected: sql<number>`COUNT(*) FILTER (WHERE ${campusEvent.status} = 'rejected')`,
      })
      .from(campusEvent),
    // Content counts: gigs
    db
      .select({
        draft: sql<number>`COUNT(*) FILTER (WHERE ${gigListing.status} = 'draft')`,
        approved: sql<number>`COUNT(*) FILTER (WHERE ${gigListing.status} = 'approved')`,
        rejected: sql<number>`COUNT(*) FILTER (WHERE ${gigListing.status} = 'rejected')`,
      })
      .from(gigListing),
    // Content counts: landmarks
    db
      .select({
        draft: sql<number>`COUNT(*) FILTER (WHERE ${landmark.status} = 'draft')`,
        approved: sql<number>`COUNT(*) FILTER (WHERE ${landmark.status} = 'approved')`,
        rejected: sql<number>`COUNT(*) FILTER (WHERE ${landmark.status} = 'rejected')`,
      })
      .from(landmark),
    // KPI: abuse alerts (24h)
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(abuseEvent)
      .where(
        and(
          gte(abuseEvent.createdAt, twentyFourHoursAgo),
          sql`${abuseEvent.decision} IN ('deny', 'throttle')`,
        ),
      ),
    // KPI: pending CM reports
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(cmReport)
      .where(eq(cmReport.status, "pending")),
    // User growth: last 30 days
    db
      .select({
        date: sql<string>`date_trunc('day', ${user.createdAt})::date::text`,
        count: sql<number>`COUNT(*)`,
      })
      .from(user)
      .where(and(gte(user.createdAt, thirtyDaysAgo), ne(user.status, "deleted")))
      .groupBy(sql`date_trunc('day', ${user.createdAt})::date`)
      .orderBy(sql`date_trunc('day', ${user.createdAt})::date`),
    // Engagement: messages (7d)
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(message)
      .where(gte(message.createdAt, sevenDaysAgo)),
    // Engagement: CM sessions (7d)
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(cmSession)
      .where(gte(cmSession.createdAt, sevenDaysAgo)),
    // Engagement: RSVPs (7d)
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(eventRsvp)
      .where(gte(eventRsvp.createdAt, sevenDaysAgo)),
    // Recent: users
    db
      .select({
        name: user.name,
        username: user.displayUsername,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(ne(user.status, "deleted"))
      .orderBy(desc(user.createdAt))
      .limit(10),
    // Recent: posts
    db
      .select({
        title: communityPost.title,
        status: communityPost.status,
        createdAt: communityPost.createdAt,
      })
      .from(communityPost)
      .orderBy(desc(communityPost.createdAt))
      .limit(10),
    // Recent: events
    db
      .select({
        title: campusEvent.title,
        status: campusEvent.status,
        createdAt: campusEvent.createdAt,
      })
      .from(campusEvent)
      .orderBy(desc(campusEvent.createdAt))
      .limit(10),
    // Recent: abuse (deny/throttle)
    db
      .select({
        action: abuseEvent.action,
        decision: abuseEvent.decision,
        createdAt: abuseEvent.createdAt,
      })
      .from(abuseEvent)
      .where(sql`${abuseEvent.decision} IN ('deny', 'throttle')`)
      .orderBy(desc(abuseEvent.createdAt))
      .limit(10),
    // Recent: CM reports
    db
      .select({
        reason: cmReport.reason,
        status: cmReport.status,
        createdAt: cmReport.createdAt,
      })
      .from(cmReport)
      .orderBy(desc(cmReport.createdAt))
      .limit(10),
  ]);

  // Build recent activity feed
  const activity: ActivityItem[] = [];

  for (const u of recentUsers) {
    activity.push({
      type: "new_user",
      title: "New user signed up",
      detail: u.username ? `@${u.username}` : u.name,
      timestamp: u.createdAt.toISOString(),
    });
  }
  for (const p of recentPosts) {
    activity.push({
      type: "new_post",
      title: p.status === "draft" ? "Post pending review" : "New post",
      detail: p.title.length > 60 ? p.title.slice(0, 60) + "..." : p.title,
      timestamp: p.createdAt.toISOString(),
    });
  }
  for (const e of recentEvents) {
    activity.push({
      type: "new_event",
      title: e.status === "draft" ? "Event pending review" : "New event",
      detail: e.title.length > 60 ? e.title.slice(0, 60) + "..." : e.title,
      timestamp: e.createdAt.toISOString(),
    });
  }
  for (const a of recentAbuse) {
    activity.push({
      type: "abuse",
      title: `Abuse ${a.decision}`,
      detail: a.action,
      timestamp: a.createdAt.toISOString(),
    });
  }
  for (const r of recentCmReports) {
    activity.push({
      type: "cm_report",
      title: "Campus Match report",
      detail: r.reason.length > 60 ? r.reason.slice(0, 60) + "..." : r.reason,
      timestamp: r.createdAt.toISOString(),
    });
  }

  activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const recentActivity = activity.slice(0, 20);

  // Fill user growth gaps
  const growthMap = new Map(userGrowthRaw.map((r) => [r.date, Number(r.count)]));
  const userGrowth: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    userGrowth.push({ date: key, count: growthMap.get(key) ?? 0 });
  }

  const p = postCounts[0];
  const ev = eventCounts[0];
  const g = gigCounts[0];
  const l = landmarkCounts[0];

  const totalContent =
    Number(p.draft) + Number(p.approved) + Number(p.rejected) +
    Number(ev.draft) + Number(ev.approved) + Number(ev.rejected) +
    Number(g.draft) + Number(g.approved) + Number(g.rejected) +
    Number(l.draft) + Number(l.approved) + Number(l.rejected);

  const pendingModeration =
    Number(p.draft) + Number(ev.draft) + Number(g.draft) + Number(l.draft);

  return {
    success: true,
    data: {
      kpis: {
        totalUsers: Number(userStats[0].total),
        newUsersThisWeek: Number(userStats[0].newThisWeek),
        totalContent,
        pendingModeration,
        activeAbuseAlerts: Number(abuseAlertCount[0].count),
        pendingCmReports: Number(cmReportCount[0].count),
      },
      recentActivity,
      userGrowth,
      contentHealth: {
        posts: { draft: Number(p.draft), approved: Number(p.approved), rejected: Number(p.rejected) },
        events: { draft: Number(ev.draft), approved: Number(ev.approved), rejected: Number(ev.rejected) },
        gigs: { draft: Number(g.draft), approved: Number(g.approved), rejected: Number(g.rejected) },
        landmarks: { draft: Number(l.draft), approved: Number(l.approved), rejected: Number(l.rejected) },
      },
      engagement: {
        messagesSent: Number(messagesCount[0].count),
        campusMatchSessions: Number(cmSessionCount[0].count),
        eventRsvps: Number(rsvpCount[0].count),
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
    cursorPromoEnabled: boolean;
    campusMatchEnabled: boolean;
    matchDailySwipeLimit: number;
  }>
> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const approvalMode = await getApprovalMode();
  const moderationPreset = await getModerationPreset();
  const customModerationRules = await getCustomModerationRules();
  const cursorPromoEnabled = await getCursorPromoEnabled();
  const campusMatchEnabled = await getCampusMatchEnabled();
  const matchDailySwipeLimit = await getMatchDailySwipeLimit();
  return {
    success: true,
    data: {
      approvalMode,
      moderationPreset,
      customModerationRules,
      cursorPromoEnabled,
      campusMatchEnabled,
      matchDailySwipeLimit,
    },
  };
}

export async function adminUpdateSettings(
  input: z.infer<typeof settingsSchema>,
): Promise<ActionResult<void>> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  if (parsed.data.approvalMode !== undefined) {
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
  }

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

  if (parsed.data.cursorPromoEnabled !== undefined) {
    await db
      .insert(adminSetting)
      .values({
        key: "cursorPromoEnabled",
        value: parsed.data.cursorPromoEnabled,
      })
      .onConflictDoUpdate({
        target: [adminSetting.key],
        set: { value: parsed.data.cursorPromoEnabled },
      });
  }

  if (parsed.data.campusMatchEnabled !== undefined) {
    await db
      .insert(adminSetting)
      .values({
        key: "campusMatchEnabled",
        value: parsed.data.campusMatchEnabled,
      })
      .onConflictDoUpdate({
        target: [adminSetting.key],
        set: { value: parsed.data.campusMatchEnabled },
      });
  }

  if (parsed.data.matchDailySwipeLimit !== undefined) {
    await db
      .insert(adminSetting)
      .values({
        key: "matchDailySwipeLimit",
        value: parsed.data.matchDailySwipeLimit,
      })
      .onConflictDoUpdate({
        target: [adminSetting.key],
        set: { value: parsed.data.matchDailySwipeLimit },
      });
  }

  return { success: true, data: undefined };
}

export type AdminCampusMatchReport = {
  id: string;
  sessionId: string;
  reason: string;
  status: "pending" | "resolved";
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reporter: {
    id: string;
    name: string;
    username: string | null;
  };
  reportedUser: {
    id: string;
    name: string;
    username: string | null;
  };
  transcriptPreview: Array<{
    id: string;
    senderAlias: string;
    body: string | null;
    imageUrl: string | null;
    createdAt: string;
  }>;
  activeBan: null | {
    banId: string;
    expiresAt: string;
    reason: string | null;
  };
};

export async function adminGetCampusMatchReports(
  status?: "pending" | "resolved",
): Promise<ActionResult<AdminCampusMatchReport[]>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const reports = await db.query.cmReport.findMany({
    where: status ? eq(cmReport.status, status) : undefined,
    with: {
      reporter: {
        columns: {
          id: true,
          name: true,
          username: true,
        },
      },
      reportedUser: {
        columns: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
    orderBy: (table, { desc: d }) => [d(table.createdAt)],
  });

  if (reports.length === 0) return { success: true, data: [] };

  const now = new Date();
  const reportedUserIds = [...new Set(reports.map((report) => report.reportedUserId))];
  const activeBans = await db
    .select({
      id: cmBan.id,
      userId: cmBan.userId,
      expiresAt: cmBan.expiresAt,
      reason: cmBan.reason,
    })
    .from(cmBan)
    .where(
      and(
        inArray(cmBan.userId, reportedUserIds),
        isNull(cmBan.liftedAt),
        gt(cmBan.expiresAt, now),
      ),
    )
    .orderBy(desc(cmBan.expiresAt));

  const activeBanByUser = new Map<string, (typeof activeBans)[number]>();
  for (const ban of activeBans) {
    if (!activeBanByUser.has(ban.userId)) {
      activeBanByUser.set(ban.userId, ban);
    }
  }

  const sessionIds = [...new Set(reports.map((r) => r.sessionId))];

  const [allParticipants, allTranscriptRows] = await Promise.all([
    db
      .select({
        sessionId: cmSessionParticipant.sessionId,
        userId: cmSessionParticipant.userId,
        alias: cmSessionParticipant.alias,
      })
      .from(cmSessionParticipant)
      .where(inArray(cmSessionParticipant.sessionId, sessionIds)),
    db
      .select({
        sessionId: cmMessage.sessionId,
        id: cmMessage.id,
        senderId: cmMessage.senderId,
        body: cmMessage.body,
        imageUrl: cmMessage.imageUrl,
        createdAt: cmMessage.createdAt,
      })
      .from(cmMessage)
      .where(inArray(cmMessage.sessionId, sessionIds))
      .orderBy(desc(cmMessage.createdAt)),
  ]);

  const participantsBySession = new Map<string, Map<string, string>>();
  for (const p of allParticipants) {
    let aliases = participantsBySession.get(p.sessionId);
    if (!aliases) {
      aliases = new Map();
      participantsBySession.set(p.sessionId, aliases);
    }
    aliases.set(p.userId, p.alias);
  }

  const transcriptBySession = new Map<string, typeof allTranscriptRows>();
  for (const row of allTranscriptRows) {
    let rows = transcriptBySession.get(row.sessionId);
    if (!rows) {
      rows = [];
      transcriptBySession.set(row.sessionId, rows);
    }
    if (rows.length < 20) {
      rows.push(row);
    }
  }

  const mapped: AdminCampusMatchReport[] = reports.map((report) => {
    const aliasByUser = participantsBySession.get(report.sessionId) ?? new Map<string, string>();
    const transcriptRows = transcriptBySession.get(report.sessionId) ?? [];

    const transcriptPreview = [...transcriptRows]
      .reverse()
      .map((row) => ({
        id: row.id,
        senderAlias: row.senderId ? aliasByUser.get(row.senderId) ?? "Unknown" : "Unknown",
        body: row.body,
        imageUrl: row.imageUrl,
        createdAt: row.createdAt.toISOString(),
      }));

    const activeBan = activeBanByUser.get(report.reportedUserId);

    return {
      id: report.id,
      sessionId: report.sessionId,
      reason: report.reason,
      status: report.status as "pending" | "resolved",
      adminNote: report.adminNote ?? null,
      createdAt: report.createdAt.toISOString(),
      reviewedAt: report.reviewedAt ? report.reviewedAt.toISOString() : null,
      reporter: {
        id: report.reporter.id,
        name: report.reporter.name,
        username: report.reporter.username,
      },
      reportedUser: {
        id: report.reportedUser.id,
        name: report.reportedUser.name,
        username: report.reportedUser.username,
      },
      transcriptPreview,
      activeBan: activeBan
        ? {
            banId: activeBan.id,
            expiresAt: activeBan.expiresAt.toISOString(),
            reason: activeBan.reason ?? null,
          }
        : null,
    };
  });

  return { success: true, data: mapped };
}

export async function adminResolveCampusMatchReport(
  input: z.infer<typeof resolveCampusMatchReportSchema>,
): Promise<ActionResult<void>> {
  const parsed = resolveCampusMatchReportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const adminSession = await requireAdmin();
  if (!adminSession) return { success: false, error: "Unauthorized" };

  const now = new Date();
  const updated = await db
    .update(cmReport)
    .set({
      status: "resolved",
      adminNote: parsed.data.adminNote ?? null,
      reviewedAt: now,
      reviewedBy: adminSession.user.id,
    })
    .where(eq(cmReport.id, parsed.data.reportId))
    .returning({
      sessionId: cmReport.sessionId,
    });

  if (updated.length === 0) {
    return { success: false, error: "Report not found" };
  }

  const participants = await db
    .select({ userId: cmSessionParticipant.userId })
    .from(cmSessionParticipant)
    .where(eq(cmSessionParticipant.sessionId, updated[0].sessionId));

  emitCampusMatchUserEvent(
    "campus_match_state_changed",
    { changedAt: now.toISOString() },
    participants.map((participant) => participant.userId),
  );

  return { success: true, data: undefined };
}

export async function adminBanUserFromCampusMatchReport(
  input: z.infer<typeof banCampusMatchReportSchema>,
): Promise<ActionResult<void>> {
  const parsed = banCampusMatchReportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const adminSession = await requireAdmin();
  if (!adminSession) return { success: false, error: "Unauthorized" };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + parsed.data.durationDays * 24 * 60 * 60 * 1000);

  const result = await db.transaction(async (tx) => {
    const reports = await tx
      .select({
        id: cmReport.id,
        sessionId: cmReport.sessionId,
        reportedUserId: cmReport.reportedUserId,
        reason: cmReport.reason,
      })
      .from(cmReport)
      .where(eq(cmReport.id, parsed.data.reportId))
      .limit(1);

    const report = reports[0];
    if (!report) {
      return { error: "Report not found", userIds: [] as string[], sessionIds: [] as string[] };
    }

    await tx
      .update(cmReport)
      .set({
        status: "resolved",
        adminNote: parsed.data.adminNote ?? null,
        reviewedAt: now,
        reviewedBy: adminSession.user.id,
      })
      .where(eq(cmReport.id, report.id));

    await tx.insert(cmBan).values({
      userId: report.reportedUserId,
      sourceReportId: report.id,
      reason: parsed.data.adminNote ?? report.reason,
      createdBy: adminSession.user.id,
      createdAt: now,
      expiresAt,
      liftedAt: null,
      liftedBy: null,
    });

    await tx.delete(cmQueueEntry).where(eq(cmQueueEntry.userId, report.reportedUserId));

    const activeSessions = await tx
      .select({
        sessionId: cmSession.id,
      })
      .from(cmSessionParticipant)
      .innerJoin(
        cmSession,
        and(
          eq(cmSession.id, cmSessionParticipant.sessionId),
          eq(cmSession.status, "active"),
        ),
      )
      .where(eq(cmSessionParticipant.userId, report.reportedUserId));

    const sessionIds = activeSessions.map((row) => row.sessionId);
    let userIds: string[] = [report.reportedUserId];

    if (sessionIds.length > 0) {
      await tx
        .update(cmSession)
        .set({
          status: "ended",
          endedReason: "banned",
          endedAt: now,
        })
        .where(inArray(cmSession.id, sessionIds));

      await tx
        .update(cmSessionParticipant)
        .set({ connectRequested: false })
        .where(inArray(cmSessionParticipant.sessionId, sessionIds));

      const participants = await tx
        .select({ userId: cmSessionParticipant.userId })
        .from(cmSessionParticipant)
        .where(inArray(cmSessionParticipant.sessionId, sessionIds));

      userIds = [...new Set([...userIds, ...participants.map((row) => row.userId)])];
    }

    return { error: null as string | null, userIds, sessionIds };
  });

  if (result.error) {
    return { success: false, error: result.error };
  }

  emitCampusMatchUserEvent(
    "campus_match_state_changed",
    { changedAt: now.toISOString() },
    result.userIds,
  );

  for (const sessionId of result.sessionIds) {
    emitCampusMatchUserEvent(
      "campus_match_session_ended",
      {
        sessionId,
        reason: "banned",
        endedAt: now.toISOString(),
      },
      result.userIds,
    );
  }

  return { success: true, data: undefined };
}

export async function adminLiftCampusMatchBan(
  input: z.infer<typeof liftCampusMatchBanSchema>,
): Promise<ActionResult<void>> {
  const parsed = liftCampusMatchBanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const adminSession = await requireAdmin();
  if (!adminSession) return { success: false, error: "Unauthorized" };

  const now = new Date();
  const lifted = await db
    .update(cmBan)
    .set({
      liftedAt: now,
      liftedBy: adminSession.user.id,
    })
    .where(and(eq(cmBan.id, parsed.data.banId), isNull(cmBan.liftedAt)))
    .returning({
      userId: cmBan.userId,
    });

  if (lifted.length === 0) {
    return { success: false, error: "Ban record not found or already lifted" };
  }

  emitCampusMatchUserEvent(
    "campus_match_state_changed",
    { changedAt: now.toISOString() },
    [lifted[0].userId],
  );

  return { success: true, data: undefined };
}

// ─── Users ────────────────────────────────────────────────────────────────────

const roleSchema = z.object({
  role: z.enum(["user", "admin"]),
});

const banSchema = z.object({
  reason: z.string().min(1),
});

export async function adminGetAllUsers(): Promise<ActionResult<unknown[]>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const rows = await db.query.user.findMany({
    orderBy: (u, { desc: d }) => [d(u.createdAt)],
  });

  return {
    success: true,
    data: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      bannedAt: r.bannedAt?.toISOString() ?? null,
      deletedAt: r.deletedAt?.toISOString() ?? null,
    })),
  };
}

export async function adminGetUserDetail(
  id: string,
): Promise<
  ActionResult<{
    user: unknown;
    counts: { posts: number; events: number; gigs: number; locations: number };
  }>
> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const row = await db.query.user.findFirst({
    where: eq(user.id, id),
  });

  if (!row) return { success: false, error: "User not found" };

  const [postCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(communityPost)
    .where(eq(communityPost.userId, id));

  const [eventCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(campusEvent)
    .where(eq(campusEvent.userId, id));

  const [gigCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(gigListing)
    .where(eq(gigListing.userId, id));

  const [locationCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(landmark)
    .where(eq(landmark.userId, id));

  return {
    success: true,
    data: {
      user: {
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        bannedAt: row.bannedAt?.toISOString() ?? null,
        deletedAt: row.deletedAt?.toISOString() ?? null,
      },
      counts: {
        posts: Number(postCount.count),
        events: Number(eventCount.count),
        gigs: Number(gigCount.count),
        locations: Number(locationCount.count),
      },
    },
  };
}

export async function adminUpdateUserRole(
  id: string,
  role: string,
): Promise<ActionResult<void>> {
  const parsed = roleSchema.safeParse({ role });
  if (!parsed.success)
    return { success: false, error: "Invalid role" };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  if (session.user.id === id)
    return { success: false, error: "Cannot change your own role" };

  await db
    .update(user)
    .set({ role: parsed.data.role })
    .where(eq(user.id, id));

  return { success: true, data: undefined };
}

export async function adminBanUser(
  id: string,
  reason: string,
): Promise<ActionResult<void>> {
  const parsed = banSchema.safeParse({ reason });
  if (!parsed.success)
    return { success: false, error: "Reason is required" };

  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  if (session.user.id === id)
    return { success: false, error: "Cannot ban yourself" };

  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        status: "banned",
        bannedAt: new Date(),
        banReason: parsed.data.reason,
      })
      .where(eq(user.id, id));
    await tx.delete(authSession).where(eq(authSession.userId, id));
  });

  return { success: true, data: undefined };
}

export async function adminUnbanUser(
  id: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const target = await db.query.user.findFirst({
    where: eq(user.id, id),
    columns: { status: true },
  });
  if (!target) return { success: false, error: "User not found" };
  if (target.status !== "banned")
    return { success: false, error: "User is not banned" };

  await db
    .update(user)
    .set({ status: "active", bannedAt: null, banReason: null })
    .where(eq(user.id, id));

  return { success: true, data: undefined };
}

export async function adminSoftDeleteUser(
  id: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  if (session.user.id === id)
    return { success: false, error: "Cannot delete yourself" };

  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({ status: "deleted", deletedAt: new Date() })
      .where(eq(user.id, id));
    await tx.delete(authSession).where(eq(authSession.userId, id));
  });

  return { success: true, data: undefined };
}

export async function adminRestoreUser(
  id: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const target = await db.query.user.findFirst({
    where: eq(user.id, id),
    columns: { status: true },
  });
  if (!target) return { success: false, error: "User not found" };
  if (target.status !== "deleted")
    return { success: false, error: "User is not deleted" };

  await db
    .update(user)
    .set({ status: "active", deletedAt: null })
    .where(eq(user.id, id));

  return { success: true, data: undefined };
}

// ─── Flairs ──────────────────────────────────────────────────────────────────

export async function adminGetUserFlairs(
  userId: string,
): Promise<ActionResult<{ id: string; label: string; color: string; tier: string }[]>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const flairs = await getUserFlairsFromDb(userId);
  return {
    success: true,
    data: flairs.map((f) => ({ id: f.id, label: f.label, color: f.color, tier: f.tier })),
  };
}

export async function adminGrantFlair(
  userId: string,
  flairId: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const def = getFlairById(flairId);
  if (!def) return { success: false, error: "Unknown flair" };

  await grantFlair(userId, flairId, "admin");
  return { success: true, data: undefined };
}

export async function adminRevokeFlair(
  userId: string,
  flairId: string,
): Promise<ActionResult<void>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  await revokeFlair(userId, flairId);
  return { success: true, data: undefined };
}

// ─── Abuse Monitor ──────────────────────────────────────────────────────────

import { clearUserCooldowns } from "@/lib/abuse/store-redis";

export async function adminGetAbuseStats(): Promise<
  ActionResult<{
    total: number;
    denied: number;
    throttled: number;
    shadow: number;
    byAction: { action: string; count: number }[];
    topOffenders: { userIdHash: string; count: number }[];
  }>
> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totals] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      denied: sql<number>`COUNT(*) FILTER (WHERE ${abuseEvent.decision} = 'deny')`,
      throttled: sql<number>`COUNT(*) FILTER (WHERE ${abuseEvent.decision} = 'throttle')`,
      shadow: sql<number>`COUNT(*) FILTER (WHERE ${abuseEvent.mode} = 'shadow')`,
    })
    .from(abuseEvent)
    .where(gte(abuseEvent.createdAt, since));

  const byAction = await db
    .select({
      action: abuseEvent.action,
      count: sql<number>`COUNT(*)`,
    })
    .from(abuseEvent)
    .where(gte(abuseEvent.createdAt, since))
    .groupBy(abuseEvent.action)
    .orderBy(sql`COUNT(*) DESC`);

  const topOffenders = await db
    .select({
      userIdHash: abuseEvent.userIdHash,
      count: sql<number>`COUNT(*)`,
    })
    .from(abuseEvent)
    .where(and(gte(abuseEvent.createdAt, since), sql`${abuseEvent.userIdHash} IS NOT NULL`))
    .groupBy(abuseEvent.userIdHash)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(10);

  return {
    success: true,
    data: {
      total: Number(totals.total),
      denied: Number(totals.denied),
      throttled: Number(totals.throttled),
      shadow: Number(totals.shadow),
      byAction: byAction.map((r) => ({ action: r.action, count: Number(r.count) })),
      topOffenders: topOffenders.map((r) => ({
        userIdHash: r.userIdHash!,
        count: Number(r.count),
      })),
    },
  };
}

export async function adminGetAbuseEvents(
  opts?: { action?: string; decision?: string; page?: number },
): Promise<ActionResult<{ events: unknown[]; hasMore: boolean }>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const PAGE_SIZE = 50;
  const page = opts?.page ?? 0;

  const conditions = [];
  if (opts?.action) conditions.push(eq(abuseEvent.action, opts.action));
  if (opts?.decision) conditions.push(eq(abuseEvent.decision, opts.decision));

  const rows = await db
    .select()
    .from(abuseEvent)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(abuseEvent.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset(page * PAGE_SIZE);

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return {
    success: true,
    data: {
      events: pageRows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      hasMore,
    },
  };
}

export async function adminClearAbuseCooldown(
  userIdHash: string,
): Promise<ActionResult<{ deleted: number }>> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  const deleted = await clearUserCooldowns(userIdHash);
  return { success: true, data: { deleted } };
}
