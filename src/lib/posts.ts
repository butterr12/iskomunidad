import type { Landmark } from "./landmarks";

export type PostType = "text" | "link" | "image";
export type PostFlair = "Discussion" | "Question" | "Selling" | "Announcement" | "Meme" | "Help" | "Rant";
export type PostStatus = "draft" | "approved" | "rejected";
export type VoteDirection = 1 | -1 | 0;
export type SortMode = "hot" | "new" | "top";

export interface CommunityPost {
  id: string;
  title: string;
  body?: string;
  type: PostType;
  author: string;
  authorHandle: string;
  authorImage?: string | null;
  flair: PostFlair;
  locationId?: string;
  createdAt: string;
  score: number;
  commentCount: number;
  userVote: VoteDirection;
  linkUrl?: string;
  imageColor?: string;
  imageEmoji?: string;
  status?: PostStatus;
  rejectionReason?: string;
}

export interface PostComment {
  id: string;
  postId: string;
  parentId: string | null;
  author: string;
  authorHandle: string;
  authorImage?: string | null;
  body: string;
  createdAt: string;
  score: number;
  userVote: VoteDirection;
}

export interface CommentNode {
  comment: PostComment;
  children: CommentNode[];
}

export const POST_FLAIRS: PostFlair[] = [
  "Discussion",
  "Question",
  "Selling",
  "Announcement",
  "Meme",
  "Help",
  "Rant",
];

export const FLAIR_COLORS: Record<PostFlair, string> = {
  Discussion: "#3b82f6",
  Question: "#8b5cf6",
  Selling: "#10b981",
  Announcement: "#f59e0b",
  Meme: "#ec4899",
  Help: "#06b6d4",
  Rant: "#ef4444",
};

export function postToLandmark(post: CommunityPost, landmarks: Landmark[]): Landmark | null {
  if (!post.locationId) return null;
  return landmarks.find((l) => l.id === post.locationId) ?? null;
}

export function getPostsAtLandmark(landmarkId: string, posts: CommunityPost[]): CommunityPost[] {
  return posts.filter((p) => p.locationId === landmarkId);
}

export function buildCommentTree(comments: PostComment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const comment of comments) {
    map.set(comment.id, { comment, children: [] });
  }

  for (const comment of comments) {
    const node = map.get(comment.id)!;
    if (comment.parentId) {
      const parent = map.get(comment.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function hotScore(post: CommunityPost): number {
  const hoursAge = (Date.now() - new Date(post.createdAt).getTime()) / 3600000;
  return post.score / Math.pow(hoursAge + 2, 1.5);
}

export function sortPosts(posts: CommunityPost[], mode: SortMode): CommunityPost[] {
  const sorted = [...posts];
  switch (mode) {
    case "hot":
      return sorted.sort((a, b) => hotScore(b) - hotScore(a));
    case "new":
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "top":
      return sorted.sort((a, b) => b.score - a.score);
  }
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
