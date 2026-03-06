"use server";

import { db } from "@/lib/db";
import { communityPost, campusEvent, gigListing } from "@/lib/schema";
import { user } from "@/lib/auth-schema";
import { and, eq, or, ilike, isNotNull } from "drizzle-orm";
import { getOptionalSession, rateLimit } from "./_helpers";
import type { ActionResult } from "./_helpers";

export type SearchResultPerson = {
  type: "person";
  id: string;
  name: string;
  username: string;
  image: string | null;
};

export type SearchResultPost = {
  type: "post";
  id: string;
  title: string;
  flair: string;
  authorName: string;
  authorHandle: string | null;
  commentCount: number;
};

export type SearchResultEvent = {
  type: "event";
  id: string;
  title: string;
  organizer: string;
  category: string;
  startDate: Date;
};

export type SearchResultGig = {
  type: "gig";
  id: string;
  title: string;
  category: string;
  compensation: string;
  isPaid: boolean;
  isOpen: boolean;
};

export type SearchResult =
  | SearchResultPerson
  | SearchResultPost
  | SearchResultEvent
  | SearchResultGig;

export type GroupedSearchResults = {
  people: SearchResultPerson[];
  posts: SearchResultPost[];
  events: SearchResultEvent[];
  gigs: SearchResultGig[];
};

const LIMIT_PER_TYPE = 5;

export async function globalSearch(
  query: string,
): Promise<ActionResult<GroupedSearchResults>> {
  const session = await getOptionalSession();

  const limited = await rateLimit("general");
  if (limited) return limited;

  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return { success: true, data: { people: [], posts: [], events: [], gigs: [] } };
  }

  const pattern = `%${trimmed}%`;

  const [people, posts, events, gigs] = await Promise.all([
    // People
    session
      ? db
          .select({
            id: user.id,
            name: user.name,
            username: user.username,
            image: user.image,
          })
          .from(user)
          .where(
            and(
              or(ilike(user.name, pattern), ilike(user.username, pattern)),
              eq(user.status, "active"),
              isNotNull(user.username),
            ),
          )
          .limit(LIMIT_PER_TYPE)
      : Promise.resolve([]),

    // Posts
    db
      .select({
        id: communityPost.id,
        title: communityPost.title,
        flair: communityPost.flair,
        commentCount: communityPost.commentCount,
        authorName: user.name,
        authorHandle: user.username,
      })
      .from(communityPost)
      .innerJoin(user, eq(communityPost.userId, user.id))
      .where(
        and(
          eq(communityPost.status, "approved"),
          or(
            ilike(communityPost.title, pattern),
            ilike(communityPost.body, pattern),
          ),
        ),
      )
      .limit(LIMIT_PER_TYPE),

    // Events
    db
      .select({
        id: campusEvent.id,
        title: campusEvent.title,
        organizer: campusEvent.organizer,
        category: campusEvent.category,
        startDate: campusEvent.startDate,
      })
      .from(campusEvent)
      .where(
        and(
          eq(campusEvent.status, "approved"),
          or(
            ilike(campusEvent.title, pattern),
            ilike(campusEvent.organizer, pattern),
            ilike(campusEvent.description, pattern),
          ),
        ),
      )
      .limit(LIMIT_PER_TYPE),

    // Gigs
    db
      .select({
        id: gigListing.id,
        title: gigListing.title,
        category: gigListing.category,
        compensation: gigListing.compensation,
        isPaid: gigListing.isPaid,
        isOpen: gigListing.isOpen,
      })
      .from(gigListing)
      .where(
        and(
          eq(gigListing.status, "approved"),
          or(
            ilike(gigListing.title, pattern),
            ilike(gigListing.description, pattern),
          ),
        ),
      )
      .limit(LIMIT_PER_TYPE),
  ]);

  return {
    success: true,
    data: {
      people: people.map((p) => ({
        type: "person" as const,
        id: p.id,
        name: p.name,
        username: p.username!,
        image: p.image,
      })),
      posts: posts.map((p) => ({
        type: "post" as const,
        id: p.id,
        title: p.title,
        flair: p.flair,
        authorName: p.authorName,
        authorHandle: p.authorHandle,
        commentCount: p.commentCount,
      })),
      events: events.map((e) => ({
        type: "event" as const,
        id: e.id,
        title: e.title,
        organizer: e.organizer,
        category: e.category,
        startDate: e.startDate,
      })),
      gigs: gigs.map((g) => ({
        type: "gig" as const,
        id: g.id,
        title: g.title,
        category: g.category,
        compensation: g.compensation,
        isPaid: g.isPaid,
        isOpen: g.isOpen,
      })),
    },
  };
}
