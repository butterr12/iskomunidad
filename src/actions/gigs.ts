"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { gigListing, gigSwipe } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import {
  type ActionResult,
  getSessionOrThrow,
  getOptionalSession,
  getApprovalMode,
  createNotification,
  createUserNotification,
} from "./_helpers";
import { moderateContent } from "@/lib/ai-moderation";
import { parseCompensation } from "@/lib/gigs";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createGigSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  posterCollege: z.string().optional(),
  compensation: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  locationId: z.string().uuid().optional(),
  locationNote: z.string().optional(),
  deadline: z.string().optional(), // ISO string
  urgency: z.enum(["flexible", "soon", "urgent"]).default("flexible"),
  contactMethod: z.string().min(1),
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
    where: (g, { eq: eqFn, and: andFn }) => {
      const conditions = [eqFn(g.status, "approved"), eqFn(g.isOpen, true)];
      if (opts?.category) conditions.push(eqFn(g.category, opts.category));
      return andFn(...conditions);
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
    })),
  };
}

export async function createGig(
  input: z.infer<typeof createGigSchema>,
): Promise<ActionResult<{ id: string; status: string }>> {
  const parsed = createGigSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

  const mode = await getApprovalMode();
  let status: string;
  let rejectionReason: string | undefined;

  if (mode === "ai") {
    const result = await moderateContent({ type: "gig", title: parsed.data.title, body: parsed.data.description });
    status = result.approved ? "approved" : "rejected";
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
      type: status === "approved" ? "gig_approved" : "gig_rejected",
      targetId: created.id,
      targetTitle: parsed.data.title,
      authorHandle: session.user.username ?? session.user.name,
      reason: rejectionReason,
    });
    await createUserNotification({
      userId: session.user.id,
      type: status === "approved" ? "gig_approved" : "gig_rejected",
      contentType: "gig",
      targetId: created.id,
      targetTitle: parsed.data.title,
      reason: rejectionReason,
    });
  }

  if (status === "rejected") {
    return { success: false, error: `Your gig was not approved: ${rejectionReason ?? "content policy violation"}` };
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

  const session = await getSessionOrThrow();
  if (!session) return { success: false, error: "Not authenticated" };

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
