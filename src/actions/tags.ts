"use server";

import { db } from "@/lib/db";
import { gigListing, campusEvent, communityPost } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { type ActionResult } from "./_helpers";

export async function getPopularTags(
  limit = 20,
): Promise<ActionResult<{ tag: string; count: number }[]>> {
  const rows = await db.execute(sql`
    SELECT tag, COUNT(*)::int AS count
    FROM (
      SELECT unnest(tags) AS tag FROM community_post WHERE status = 'approved'
      UNION ALL
      SELECT unnest(tags) AS tag FROM gig_listing WHERE status = 'approved'
      UNION ALL
      SELECT unnest(tags) AS tag FROM campus_event WHERE status = 'approved'
    ) t
    WHERE tag != ''
    GROUP BY tag
    ORDER BY count DESC, tag ASC
    LIMIT ${limit}
  `);
  return {
    success: true,
    data: rows.rows as { tag: string; count: number }[],
  };
}

export async function getTagSuggestions(
  prefix?: string,
): Promise<ActionResult<string[]>> {
  const result = await getPopularTags(100);
  if (!result.success) return { success: false, error: result.error };
  let tags = result.data.map((d) => d.tag);
  if (prefix) {
    const clean = prefix.toLowerCase().replace(/^#+/, "").trim();
    if (clean) tags = tags.filter((t) => t.startsWith(clean));
  }
  return { success: true, data: tags };
}

export async function getContentByTag(
  tag: string,
): Promise<ActionResult<{ posts: unknown[]; gigs: unknown[]; events: unknown[] }>> {
  const [posts, gigs, events] = await Promise.all([
    db.query.communityPost.findMany({
      where: (p, { eq: e, and: a }) =>
        a(e(p.status, "approved"), sql`${p.tags} @> ARRAY[${tag}]::text[]` as ReturnType<typeof e>),
      with: {
        user: { columns: { name: true, username: true, image: true } },
        images: {
          columns: { imageKey: true, order: true },
          orderBy: (img, { asc }) => [asc(img.order)],
        },
        event: { columns: { id: true, title: true, coverColor: true } },
      },
      orderBy: (p, { desc: d }) => [d(p.score), d(p.createdAt)],
      limit: 50,
    }),
    db.query.gigListing.findMany({
      where: (g, { eq: e, and: a }) =>
        a(
          e(g.status, "approved"),
          e(g.isOpen, true),
          sql`${g.tags} @> ARRAY[${tag}]::text[]` as ReturnType<typeof e>,
        ),
      with: {
        user: { columns: { name: true, username: true, image: true } },
      },
      orderBy: (g, { desc: d }) => [d(g.createdAt)],
      limit: 50,
    }),
    db.query.campusEvent.findMany({
      where: (ev, { eq: e, and: a }) =>
        a(e(ev.status, "approved"), sql`${ev.tags} @> ARRAY[${tag}]::text[]` as ReturnType<typeof e>),
      orderBy: (ev, { desc: d }) => [d(ev.startDate)],
      limit: 50,
    }),
  ]);

  return {
    success: true,
    data: {
      posts: posts.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        author: r.user.name,
        authorHandle: r.user.username ? `@${r.user.username}` : null,
        authorImage: r.user.image,
        imageKeys: r.images.map((img) => img.imageKey),
        userVote: 0 as const,
        isBookmarked: false,
        eventId: r.eventId ?? null,
        eventTitle: r.event?.title ?? null,
        eventColor: r.event?.coverColor ?? null,
      })),
      gigs: gigs.map((r) => ({
        ...r,
        deadline: r.deadline?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        posterId: r.userId,
        posterName: r.user.name,
        posterHandle: r.user.username ? `@${r.user.username}` : null,
        swipeAction: null,
      })),
      events: events.map((r) => ({
        ...r,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        rsvpStatus: null,
      })),
    },
  };
}
