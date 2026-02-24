import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  communityPost,
  commentVote,
  postVote,
  postBookmark,
} from "@/lib/schema";

export type VoteDirection = -1 | 0 | 1;

export interface PermalinkPost {
  id: string;
  title: string;
  body: string | null;
  flair: string;
  tags: string[];
  author: string;
  authorHandle: string | null;
  authorImage: string | null;
  createdAt: string;
  updatedAt: string;
  score: number;
  commentCount: number;
  userVote: VoteDirection;
  isBookmarked: boolean;
  locationId: string | null;
  linkUrl: string | null;
  imageKeys: string[];
  userId: string;
  eventId: string | null;
  eventTitle: string | null;
  eventColor: string | null;
}

export interface PermalinkComment {
  id: string;
  postId: string;
  parentId: string | null;
  author: string;
  authorHandle: string | null;
  authorImage: string | null;
  body: string;
  createdAt: string;
  score: number;
  userVote: VoteDirection;
}

export interface PermalinkPostData {
  post: PermalinkPost;
  comments: PermalinkComment[];
}

function toVoteDirection(value: number | null | undefined): VoteDirection {
  if (value === 1 || value === -1) return value;
  return 0;
}

function mapPost(
  row: {
    id: string;
    userId: string;
    title: string;
    body: string | null;
    flair: string;
    tags: string[];
    score: number;
    commentCount: number;
    locationId: string | null;
    eventId: string | null;
    linkUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: { name: string | null; username: string | null; image: string | null };
    images: { imageKey: string; order: number }[];
    event?: { id: string; title: string; coverColor: string } | null;
  },
  userVote: VoteDirection,
  isBookmarked: boolean,
): PermalinkPost {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    body: row.body,
    flair: row.flair,
    author: row.user.name ?? "Unknown",
    authorHandle: row.user.username ? `@${row.user.username}` : null,
    authorImage: row.user.image,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    score: row.score,
    commentCount: row.commentCount,
    userVote,
    isBookmarked,
    locationId: row.locationId,
    linkUrl: row.linkUrl,
    imageKeys: row.images.map((image) => image.imageKey),
    tags: row.tags,
    eventId: row.event?.id ?? row.eventId ?? null,
    eventTitle: row.event?.title ?? null,
    eventColor: row.event?.coverColor ?? null,
  };
}

export async function getApprovedPermalinkPost(
  postId: string,
  viewerId?: string,
): Promise<PermalinkPostData | null> {
  const postWhere = and(
    eq(communityPost.id, postId),
    eq(communityPost.status, "approved"),
  );

  // Unauthenticated: fetch post without comments
  if (!viewerId) {
    const row = await db.query.communityPost.findFirst({
      where: postWhere,
      with: {
        user: { columns: { name: true, username: true, image: true } },
        images: {
          columns: { imageKey: true, order: true },
          orderBy: (img, { asc }) => [asc(img.order)],
        },
        event: { columns: { id: true, title: true, coverColor: true } },
      },
    });

    if (!row) return null;

    return {
      post: mapPost(row, 0, false),
      comments: [],
    };
  }

  // Authenticated: fetch post with comments + viewer votes
  const row = await db.query.communityPost.findFirst({
    where: postWhere,
    with: {
      user: { columns: { name: true, username: true, image: true } },
      images: {
        columns: { imageKey: true, order: true },
        orderBy: (img, { asc }) => [asc(img.order)],
      },
      event: { columns: { id: true, title: true, coverColor: true } },
      comments: {
        with: {
          user: {
            columns: { name: true, username: true, image: true },
          },
        },
        orderBy: (c, { asc }) => [asc(c.createdAt)],
      },
    },
  });

  if (!row) return null;

  const viewerPostVote = await db.query.postVote.findFirst({
    where: and(
      eq(postVote.userId, viewerId),
      eq(postVote.postId, postId),
    ),
    columns: { value: true },
  });
  const postUserVote = toVoteDirection(viewerPostVote?.value);

  const viewerBookmark = await db.query.postBookmark.findFirst({
    where: and(
      eq(postBookmark.userId, viewerId),
      eq(postBookmark.postId, postId),
    ),
    columns: { id: true },
  });
  const isBookmarked = !!viewerBookmark;

  let commentVoteMap: Record<string, VoteDirection> = {};
  const commentIds = row.comments.map((comment) => comment.id);
  if (commentIds.length > 0) {
    const viewerCommentVotes = await db.query.commentVote.findMany({
      where: and(
        eq(commentVote.userId, viewerId),
        inArray(commentVote.commentId, commentIds),
      ),
      columns: { commentId: true, value: true },
    });
    commentVoteMap = Object.fromEntries(
      viewerCommentVotes.map((vote) => [
        vote.commentId,
        toVoteDirection(vote.value),
      ]),
    );
  }

  return {
    post: mapPost(row, postUserVote, isBookmarked),
    comments: row.comments.map((comment) => ({
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      author: comment.user.name ?? "Unknown",
      authorHandle: comment.user.username ? `@${comment.user.username}` : null,
      authorImage: comment.user.image,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      score: comment.score,
      userVote: commentVoteMap[comment.id] ?? 0,
    })),
  };
}
