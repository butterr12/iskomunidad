"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { gigListing, gigSwipe } from "@/lib/schema";
import { eq, and, or, sql } from "drizzle-orm";
import {
  type ActionResult,
  getSession,
  getOptionalSession,
  getApprovalMode,
  createNotification,
  createUserNotification,
  guardAction,
} from "./_helpers";
import { moderateContent } from "@/lib/ai-moderation";
import { parseCompensation } from "@/lib/gigs";
import { isoDateString } from "@/lib/validation/date";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createGigSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  posterCollege: z.string().optional(),
  compensation: z.string().min(1).max(200),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  locationId: z.string().uuid().optional(),
  locationNote: z.string().optional(),
  deadline: isoDateString.optional(),
  urgency: z.enum(["flexible", "soon", "urgent"]).default("flexible"),
  contactMethod: z.string().min(1).max(500),
});

const swipeSchema = z.object({
  action: z.enum(["saved", "skipped"]).nullable(),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getApprovedGigs(
  opts?: { category?: string; sort?: "newest" | "pay" | "deadline" },
): Promise<ActionResult<unknown[]>> {
  const session = await getOptionalSession();

  const rows = await db.query.gigListing.findMany({
    where: (g, { eq: eqFn, and: andFn, or: orFn }) => {
      const categoryFilter = opts?.category ? eqFn(g.category, opts.category) : undefined;
      const publicGigs = andFn(
        eqFn(g.status, "approved"),
        eqFn(g.isOpen, true),
        ...(categoryFilter ? [categoryFilter] : []),
      );
      if (session?.user) {
        const ownApproved = andFn(
          eqFn(g.userId, session.user.id),
          eqFn(g.status, "approved"),
          ...(categoryFilter ? [categoryFilter] : []),
        );
        return orFn(publicGigs, ownApproved);
      }
      return publicGigs;
    },
    with: {
      user: { columns: { name: true, username: true, image: true } },
    },
    orderBy: (g, { desc: d, asc: a }) => {
      if (opts?.sort === "pay") return [d(g.compensationValue)];
      if (opts?.sort === "deadline") return [a(g.deadline)];
      return [d(g.createdAt)]; // newest
    },
  });

  // Get current user's swipes
  let userSwipes: Record<string, string> = {};
  if (session?.user) {
    const swipes = await db.query.gigSwipe.findMany({
      where: eq(gigSwipe.userId, session.user.id),
    });
    userSwipes = Object.fromEntries(swipes.map((s) => [s.gigId, s.action]));
  }

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
      userSwipe: userSwipes[r.id] ?? null,
      posterId: r.userId,
    })),
  };
}

export async function createGig(
  input: z.infer<typeof createGigSchema>,
): Promise<ActionResult<{ id: string; status: string }>> {
  const parsed = createGigSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const limited = await guardAction("gig.create", {
    userId: session.user.id,
    contentBody: parsed.data.title + parsed.data.description,
  });
  if (limited) return limited;

  const mode = await getApprovalMode();
  let status: string;
  let rejectionReason: string | undefined;

  if (mode === "ai") {
    const result = await moderateContent({ type: "gig", title: parsed.data.title, body: parsed.data.description });
    status = result.approved ? "approved" : "draft";
    rejectionReason = result.reason;
  } else {
    status = mode === "auto" ? "approved" : "draft";
  }

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
      status,
      rejectionReason: rejectionReason ?? null,
      userId: session.user.id,
    })
    .returning({ id: gigListing.id });

  if (mode === "manual") {
    await createNotification({
      type: "gig_pending",
      targetId: created.id,
      targetTitle: parsed.data.title,
      authorHandle: session.user.username ?? session.user.name,
    });
    await createUserNotification({
      userId: session.user.id,
      type: "gig_pending",
      contentType: "gig",
      targetId: created.id,
      targetTitle: parsed.data.title,
    });
  } else if (mode === "ai") {
    await createNotification({
      type: status === "approved" ? "gig_approved" : "gig_pending",
      targetId: created.id,
      targetTitle: parsed.data.title,
      authorHandle: session.user.username ?? session.user.name,
      reason: rejectionReason,
    });
    await createUserNotification({
      userId: session.user.id,
      type: status === "approved" ? "gig_approved" : "gig_pending",
      contentType: "gig",
      targetId: created.id,
      targetTitle: parsed.data.title,
    });
  }

  return { success: true, data: { id: created.id, status } };
}

export async function swipeGig(
  gigId: string,
  action: "saved" | "skipped" | null,
): Promise<ActionResult<void>> {
  const parsed = swipeSchema.safeParse({ action });
  if (!parsed.success)
    return { success: false, error: "Invalid swipe action" };

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const swipeLimited = await guardAction("gig.swipe", { userId: session.user.id });
  if (swipeLimited) return swipeLimited;

  const gig = await db.query.gigListing.findFirst({
    where: eq(gigListing.id, gigId),
    columns: { status: true, isOpen: true },
  });
  if (!gig || gig.status !== "approved" || !gig.isOpen) {
    return { success: false, error: "Gig not found" };
  }

  if (parsed.data.action === null) {
    await db
      .delete(gigSwipe)
      .where(
        and(
          eq(gigSwipe.gigId, gigId),
          eq(gigSwipe.userId, session.user.id),
        ),
      );
  } else {
    await db
      .insert(gigSwipe)
      .values({
        gigId,
        userId: session.user.id,
        action: parsed.data.action,
      })
      .onConflictDoUpdate({
        target: [gigSwipe.userId, gigSwipe.gigId],
        set: { action: parsed.data.action },
      });
  }

  return { success: true, data: undefined };
}

export async function getGigTags(): Promise<ActionResult<string[]>> {
  const rows = await db.query.gigListing.findMany({
    where: eq(gigListing.status, "approved"),
    columns: { tags: true },
  });
  const unique = [...new Set(rows.flatMap((r) => r.tags))].sort();
  return { success: true, data: unique };
}

export async function expressInterestInGig(
  gigId: string,
): Promise<ActionResult<{ alreadyInterested: boolean }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const limited = await guardAction("gig.interest", { userId: session.user.id });
  if (limited) return limited;

  const gig = await db.query.gigListing.findFirst({
    where: eq(gigListing.id, gigId),
    columns: { status: true, isOpen: true, userId: true, title: true },
  });
  if (!gig || gig.status !== "approved" || !gig.isOpen)
    return { success: false, error: "Gig not found" };

  if (gig.userId === session.user.id)
    return { success: false, error: "You cannot express interest in your own gig" };

  const result = await db.transaction(async (tx) => {
    const existing = await tx.query.gigSwipe.findFirst({
      where: and(eq(gigSwipe.gigId, gigId), eq(gigSwipe.userId, session.user.id)),
      columns: { action: true },
    });
    if (existing?.action === "interested") return { alreadyInterested: true };

    await tx
      .insert(gigSwipe)
      .values({ gigId, userId: session.user.id, action: "interested" })
      .onConflictDoUpdate({
        target: [gigSwipe.userId, gigSwipe.gigId],
        set: { action: "interested" },
      });

    await tx
      .update(gigListing)
      .set({ applicantCount: sql`${gigListing.applicantCount} + 1` })
      .where(eq(gigListing.id, gigId));

    return { alreadyInterested: false };
  });

  if (!result.alreadyInterested) {
    await createUserNotification({
      userId: gig.userId,
      type: "gig_interest",
      contentType: "gig",
      targetId: gigId,
      targetTitle: gig.title,
      actor: session.user.username ?? session.user.name,
    });
  }

  return { success: true, data: result };
}

export async function closeGig(gigId: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const gig = await db.query.gigListing.findFirst({
    where: eq(gigListing.id, gigId),
    columns: { userId: true },
  });
  if (!gig) return { success: false, error: "Gig not found" };
  if (gig.userId !== session.user.id) return { success: false, error: "Not authorized" };

  await db.update(gigListing).set({ isOpen: false }).where(eq(gigListing.id, gigId));
  return { success: true, data: undefined };
}

export async function reopenGig(gigId: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const gig = await db.query.gigListing.findFirst({
    where: eq(gigListing.id, gigId),
    columns: { userId: true },
  });
  if (!gig) return { success: false, error: "Gig not found" };
  if (gig.userId !== session.user.id) return { success: false, error: "Not authorized" };

  await db.update(gigListing).set({ isOpen: true }).where(eq(gigListing.id, gigId));
  return { success: true, data: undefined };
}

export async function deleteGig(gigId: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const gig = await db.query.gigListing.findFirst({
    where: eq(gigListing.id, gigId),
    columns: { userId: true },
  });
  if (!gig) return { success: false, error: "Gig not found" };

  const isAdmin = (session.user as { role?: string }).role === "admin";
  if (gig.userId !== session.user.id && !isAdmin) {
    return { success: false, error: "Not authorized" };
  }

  await db.delete(gigListing).where(eq(gigListing.id, gigId));
  return { success: true, data: undefined };
}

export async function updateGig(
  gigId: string,
  input: z.infer<typeof createGigSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createGigSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const gig = await db.query.gigListing.findFirst({
    where: eq(gigListing.id, gigId),
    columns: { userId: true, status: true },
  });
  if (!gig) return { success: false, error: "Gig not found" };
  if (gig.userId !== session.user.id) return { success: false, error: "Not authorized" };

  const limited = await guardAction("gig.update", {
    userId: session.user.id,
    contentBody: parsed.data.title + parsed.data.description,
  });
  if (limited) return limited;

  const { value: compensationValue, isPaid } = parseCompensation(parsed.data.compensation);

  const mode = await getApprovalMode();
  let newStatus = gig.status;
  let rejectionReason: string | undefined;

  if (mode === "ai") {
    const result = await moderateContent({ type: "gig", title: parsed.data.title, body: parsed.data.description });
    newStatus = result.approved ? "approved" : "draft";
    rejectionReason = result.reason;
  }

  await db
    .update(gigListing)
    .set({
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
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      urgency: parsed.data.urgency,
      contactMethod: parsed.data.contactMethod,
      status: newStatus,
      rejectionReason: rejectionReason ?? null,
    })
    .where(eq(gigListing.id, gigId));

  return { success: true, data: { id: gigId } };
}

// ─── Get gigs by user ID (for profile page) ──────────────────────────────────

export async function getUserGigsById(
  userId: string,
): Promise<ActionResult<unknown[]>> {
  const session = await getOptionalSession();
  const isOwner = session?.user?.id === userId;

  const rows = await db.query.gigListing.findMany({
    where: (g, { eq: eqFn, and: andFn, or: orFn }) => {
      const approved = andFn(eqFn(g.userId, userId), eqFn(g.status, "approved"));
      if (isOwner) {
        return eqFn(g.userId, userId);
      }
      return approved;
    },
    with: {
      user: { columns: { name: true, username: true, image: true } },
    },
    orderBy: (g, { desc: d }) => [d(g.createdAt)],
  });

  let userSwipes: Record<string, string> = {};
  if (session?.user) {
    const swipes = await db.query.gigSwipe.findMany({
      where: eq(gigSwipe.userId, session.user.id),
    });
    userSwipes = Object.fromEntries(swipes.map((s) => [s.gigId, s.action]));
  }

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
      userSwipe: userSwipes[r.id] ?? null,
      posterId: r.userId,
    })),
  };
}
