"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { campusEvent, eventRsvp } from "@/lib/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import {
  type ActionResult,
  getSessionOrThrow,
  getOptionalSession,
  getAutoApproveSetting,
  createNotification,
} from "./_helpers";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(["academic", "cultural", "social", "sports", "org"]),
  organizer: z.string().min(1),
  startDate: z.string(), // ISO string
  endDate: z.string(),
  locationId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  coverColor: z.string().default("#3b82f6"),
});

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.enum(["academic", "cultural", "social", "sports", "org"]).optional(),
  organizer: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  locationId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
  coverColor: z.string().optional(),
});

const rsvpSchema = z.object({
  status: z.enum(["going", "interested"]).nullable(),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getApprovedEvents(
  opts?: { category?: string },
): Promise<ActionResult<unknown[]>> {
  const session = await getOptionalSession();

  const rows = await db.query.campusEvent.findMany({
    where: (e, { eq: eqFn, and: andFn }) => {
      const conditions = [eqFn(e.status, "approved")];
      if (opts?.category) conditions.push(eqFn(e.category, opts.category));
      return conditions.length === 1 ? conditions[0] : andFn(...conditions);
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
): Promise<ActionResult<{ id: string }>> {
  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  const autoApprove = await getAutoApproveSetting();
  const status = autoApprove ? "approved" : "draft";

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
      userId: session.user.id,
    })
    .returning({ id: campusEvent.id });

  if (!autoApprove) {
    await createNotification({
      type: "event_pending",
      targetId: created.id,
      targetTitle: parsed.data.title,
      authorHandle: session.user.username ?? session.user.name,
    });
  }

  return { success: true, data: { id: created.id } };
}

export async function rsvpToEvent(
  eventId: string,
  status: "going" | "interested" | null,
): Promise<ActionResult<void>> {
  const parsed = rsvpSchema.safeParse({ status });
  if (!parsed.success)
    return { success: false, error: "Invalid RSVP status" };

  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

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
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateEventSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  const existing = await db.query.campusEvent.findFirst({
    where: eq(campusEvent.id, id),
  });
  if (!existing) return { success: false, error: "Event not found" };
  if (existing.userId !== session.user.id)
    return { success: false, error: "Not authorized" };

  const autoApprove = await getAutoApproveSetting();

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

  if (!autoApprove) {
    updateData.status = "draft";
  }

  await db.update(campusEvent).set(updateData).where(eq(campusEvent.id, id));

  if (!autoApprove) {
    await createNotification({
      type: "event_pending",
      targetId: id,
      targetTitle: parsed.data.title ?? existing.title,
      authorHandle: session.user.username ?? session.user.name,
    });
  }

  return { success: true, data: { id } };
}

export async function deleteEvent(
  id: string,
): Promise<ActionResult<void>> {
  const session = await getSessionOrThrow();
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
  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  const rows = await db.query.campusEvent.findMany({
    where: eq(campusEvent.userId, session.user.id),
    orderBy: [desc(campusEvent.createdAt)],
  });

  return {
    success: true,
    data: rows.map((r) => ({
      ...r,
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
