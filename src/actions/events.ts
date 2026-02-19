"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { campusEvent, eventRsvp } from "@/lib/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import {
  type ActionResult,
  getSession,
  getOptionalSession,
  getApprovalMode,
  createNotification,
  createUserNotification,
  rateLimit,
} from "./_helpers";
import { moderateContent } from "@/lib/ai-moderation";
import { isoDateString } from "@/lib/validation/date";

// ─── Schemas ──────────────────────────────────────────────────────────────────

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

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.enum(["academic", "cultural", "social", "sports", "org"]).optional(),
  organizer: z.string().min(1).optional(),
  startDate: isoDateString.optional(),
  endDate: isoDateString.optional(),
  locationId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
  coverColor: z.string().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate).getTime() >= new Date(data.startDate).getTime();
    }
    return true;
  },
  { message: "End date must be on or after start date", path: ["endDate"] },
);

const rsvpSchema = z.object({
  status: z.enum(["going", "interested"]).nullable(),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getApprovedEvents(
  opts?: { category?: string },
): Promise<ActionResult<unknown[]>> {
  const session = await getOptionalSession();

  const pastCutoff = new Date();
  pastCutoff.setDate(pastCutoff.getDate() - 1);

  const rows = await db.query.campusEvent.findMany({
    where: (e, { eq: eqFn, and: andFn, gte }) => {
      const conditions = [eqFn(e.status, "approved"), gte(e.endDate, pastCutoff)];
      if (opts?.category) conditions.push(eqFn(e.category, opts.category));
      return andFn(...conditions);
    },
    with: {
      user: { columns: { name: true, username: true, image: true } },
    },
    orderBy: (e, { asc }) => [asc(e.startDate)],
  });

  // Get current user's RSVPs
  let userRsvps: Record<string, string> = {};
  if (session?.user) {
    const rsvps = await db.query.eventRsvp.findMany({
      where: eq(eventRsvp.userId, session.user.id),
    });
    userRsvps = Object.fromEntries(rsvps.map((r) => [r.eventId, r.status]));
  }

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
      userRsvp: userRsvps[r.id] ?? null,
    })),
  };
}

export async function getEventsForLandmark(
  landmarkId: string,
): Promise<ActionResult<unknown[]>> {
  const session = await getOptionalSession();

  const rows = await db.query.campusEvent.findMany({
    where: (e, { eq: eqFn, and: andFn }) =>
      andFn(eqFn(e.status, "approved"), eqFn(e.locationId, landmarkId)),
    with: {
      user: { columns: { name: true, username: true, image: true } },
    },
    orderBy: (e, { asc }) => [asc(e.startDate)],
  });

  let userRsvps: Record<string, string> = {};
  if (session?.user) {
    const rsvps = await db.query.eventRsvp.findMany({
      where: eq(eventRsvp.userId, session.user.id),
    });
    userRsvps = Object.fromEntries(rsvps.map((r) => [r.eventId, r.status]));
  }

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
      userRsvp: userRsvps[r.id] ?? null,
    })),
  };
}

export async function getEventById(
  id: string,
): Promise<ActionResult<unknown>> {
  const session = await getOptionalSession();

  const row = await db.query.campusEvent.findFirst({
    where: eq(campusEvent.id, id),
    with: {
      user: { columns: { name: true, username: true, image: true } },
    },
  });

  if (!row) return { success: false, error: "Event not found" };

  const isOwner = session?.user.id === row.userId;
  const isAdmin = session?.user.role === "admin";
  if (row.status !== "approved" && !isOwner && !isAdmin) {
    return { success: false, error: "Event not found" };
  }

  let userRsvp: string | null = null;
  if (session?.user) {
    const rsvp = await db.query.eventRsvp.findFirst({
      where: and(
        eq(eventRsvp.eventId, id),
        eq(eventRsvp.userId, session.user.id),
      ),
    });
    userRsvp = rsvp?.status ?? null;
  }

  return {
    success: true,
    data: {
      ...row,
      rejectionReason: (isAdmin || row.status === "rejected") ? row.rejectionReason : undefined,
      startDate: row.startDate.toISOString(),
      endDate: row.endDate.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      author: row.user.name,
      authorHandle: row.user.username ? `@${row.user.username}` : null,
      authorImage: row.user.image,
      userRsvp,
    },
  };
}

export async function createEvent(
  input: z.infer<typeof createEventSchema>,
): Promise<ActionResult<{ id: string; status: string }>> {
  const limited = await rateLimit("create");
  if (limited) return limited;

  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const mode = await getApprovalMode();
  let status: string;
  let rejectionReason: string | undefined;

  if (mode === "ai") {
    const result = await moderateContent({ type: "event", title: parsed.data.title, body: parsed.data.description });
    status = result.approved ? "approved" : "draft";
    rejectionReason = result.reason;
  } else {
    status = mode === "auto" ? "approved" : "draft";
  }

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
      status,
      rejectionReason: rejectionReason ?? null,
      userId: session.user.id,
    })
    .returning({ id: campusEvent.id });

  if (mode === "manual") {
    await createNotification({
      type: "event_pending",
      targetId: created.id,
      targetTitle: parsed.data.title,
      authorHandle: session.user.username ?? session.user.name,
    });
    await createUserNotification({
      userId: session.user.id,
      type: "event_pending",
      contentType: "event",
      targetId: created.id,
      targetTitle: parsed.data.title,
    });
  } else if (mode === "ai") {
    await createNotification({
      type: status === "approved" ? "event_approved" : "event_pending",
      targetId: created.id,
      targetTitle: parsed.data.title,
      authorHandle: session.user.username ?? session.user.name,
      reason: rejectionReason,
    });
    await createUserNotification({
      userId: session.user.id,
      type: status === "approved" ? "event_approved" : "event_pending",
      contentType: "event",
      targetId: created.id,
      targetTitle: parsed.data.title,
    });
  }

  return { success: true, data: { id: created.id, status } };
}

export async function rsvpToEvent(
  eventId: string,
  status: "going" | "interested" | null,
): Promise<ActionResult<void>> {
  const parsed = rsvpSchema.safeParse({ status });
  if (!parsed.success)
    return { success: false, error: "Invalid RSVP status" };

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const event = await db.query.campusEvent.findFirst({
    where: eq(campusEvent.id, eventId),
    columns: { status: true },
  });
  if (!event || event.status !== "approved") {
    return { success: false, error: "Event not found" };
  }

  if (parsed.data.status === null) {
    // Remove RSVP
    await db
      .delete(eventRsvp)
      .where(
        and(
          eq(eventRsvp.eventId, eventId),
          eq(eventRsvp.userId, session.user.id),
        ),
      );
  } else {
    // Upsert RSVP
    await db
      .insert(eventRsvp)
      .values({
        eventId,
        userId: session.user.id,
        status: parsed.data.status,
      })
      .onConflictDoUpdate({
        target: [eventRsvp.userId, eventRsvp.eventId],
        set: { status: parsed.data.status },
      });
  }

  // Recalculate counts
  const [goingCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(eventRsvp)
    .where(
      and(eq(eventRsvp.eventId, eventId), eq(eventRsvp.status, "going")),
    );

  const [interestedCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(eventRsvp)
    .where(
      and(
        eq(eventRsvp.eventId, eventId),
        eq(eventRsvp.status, "interested"),
      ),
    );

  await db
    .update(campusEvent)
    .set({
      attendeeCount: Number(goingCount.count),
      interestedCount: Number(interestedCount.count),
    })
    .where(eq(campusEvent.id, eventId));

  return { success: true, data: undefined };
}

export async function updateEvent(
  id: string,
  input: z.infer<typeof updateEventSchema>,
): Promise<ActionResult<{ id: string; status: string }>> {
  const parsed = updateEventSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const existing = await db.query.campusEvent.findFirst({
    where: eq(campusEvent.id, id),
  });
  if (!existing) return { success: false, error: "Event not found" };
  if (existing.userId !== session.user.id)
    return { success: false, error: "Not authorized" };

  const mode = await getApprovalMode();

  const updateData: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
  if (parsed.data.organizer !== undefined) updateData.organizer = parsed.data.organizer;
  if (parsed.data.startDate !== undefined) updateData.startDate = new Date(parsed.data.startDate);
  if (parsed.data.endDate !== undefined) updateData.endDate = new Date(parsed.data.endDate);
  if (parsed.data.locationId !== undefined) updateData.locationId = parsed.data.locationId ?? null;
  if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;
  if (parsed.data.coverColor !== undefined) updateData.coverColor = parsed.data.coverColor;

  // Validate date range against existing dates when only one date is updated
  const effectiveStart = parsed.data.startDate ? new Date(parsed.data.startDate) : existing.startDate;
  const effectiveEnd = parsed.data.endDate ? new Date(parsed.data.endDate) : existing.endDate;
  if (effectiveEnd.getTime() < effectiveStart.getTime()) {
    return { success: false, error: "End date must be on or after start date" };
  }

  let status: string;
  let rejectionReason: string | undefined;

  if (mode === "ai") {
    const title = parsed.data.title ?? existing.title;
    const description = parsed.data.description ?? existing.description;
    const result = await moderateContent({ type: "event", title, body: description });
    status = result.approved ? "approved" : "draft";
    rejectionReason = result.reason;
    updateData.status = status;
    updateData.rejectionReason = rejectionReason ?? null;
  } else if (mode === "auto") {
    status = "approved";
    updateData.status = status;
    updateData.rejectionReason = null;
  } else {
    status = "draft";
    updateData.status = status;
    updateData.rejectionReason = null;
  }

  await db.update(campusEvent).set(updateData).where(eq(campusEvent.id, id));

  const updatedTitle = parsed.data.title ?? existing.title;

  if (mode === "manual") {
    await createNotification({
      type: "event_pending",
      targetId: id,
      targetTitle: updatedTitle,
      authorHandle: session.user.username ?? session.user.name,
    });
    await createUserNotification({
      userId: session.user.id,
      type: "event_pending",
      contentType: "event",
      targetId: id,
      targetTitle: updatedTitle,
    });
  } else if (mode === "ai") {
    await createNotification({
      type: status === "approved" ? "event_approved" : "event_pending",
      targetId: id,
      targetTitle: updatedTitle,
      authorHandle: session.user.username ?? session.user.name,
      reason: rejectionReason,
    });
    await createUserNotification({
      userId: session.user.id,
      type: status === "approved" ? "event_approved" : "event_pending",
      contentType: "event",
      targetId: id,
      targetTitle: updatedTitle,
    });
  }

  return {
    success: true,
    data: { id, status },
  };
}

export async function deleteEvent(
  id: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const existing = await db.query.campusEvent.findFirst({
    where: eq(campusEvent.id, id),
  });
  if (!existing) return { success: false, error: "Event not found" };
  if (existing.userId !== session.user.id)
    return { success: false, error: "Not authorized" };

  await db.delete(campusEvent).where(eq(campusEvent.id, id));
  return { success: true, data: undefined };
}

export async function getUserEvents(): Promise<ActionResult<unknown[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const rows = await db.query.campusEvent.findMany({
    where: eq(campusEvent.userId, session.user.id),
    orderBy: [desc(campusEvent.createdAt)],
  });

  return {
    success: true,
    data: rows.map((r) => ({
      ...r,
      rejectionReason: r.status === "rejected" ? r.rejectionReason : undefined,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      rsvpStatus: null,
      attendeeCount: r.attendeeCount,
      interestedCount: r.interestedCount,
    })),
  };
}
