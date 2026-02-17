"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, MapPin, Share2, Bookmark, ExternalLink } from "lucide-react";
import { VoteControls } from "./vote-controls";
import { CommentSection } from "./comment-section";
import {
  FLAIR_COLORS,
  formatRelativeTime,
  type CommunityPost,
  type PostComment,
  type VoteDirection,
} from "@/lib/posts";

interface PostDetailProps {
  post: CommunityPost;
  comments: PostComment[];
  onBack: () => void;
  onVotePost: (direction: VoteDirection) => void;
  onVoteComment: (commentId: string, direction: VoteDirection) => void;
  onComment: (body: string) => Promise<void>;
  onReply: (parentId: string, body: string) => Promise<void>;
}

export function PostDetail({
  post,
  comments,
  onBack,
  onVotePost,
  onVoteComment,
  onComment,
  onReply,
}: PostDetailProps) {
  const router = useRouter();
  const postComments = comments.filter((c) => c.postId === post.id);

  return (
    <div className="flex flex-col">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 border-b px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Community
      </button>

      <div className="flex flex-col gap-4 p-5">
        {/* Vote + title */}
        <div className="flex gap-3">
          <VoteControls score={post.score} userVote={post.userVote} onVote={onVotePost} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h2 className="text-xl font-semibold leading-tight">{post.title}</h2>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                style={{ borderColor: FLAIR_COLORS[post.flair], color: FLAIR_COLORS[post.flair] }}
              >
                {post.flair}
              </Badge>
              <Avatar className="h-5 w-5">
                {post.authorImage && <AvatarImage src={post.authorImage} alt={post.author} />}
                <AvatarFallback className="text-[9px] font-medium">
                  {post.author?.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <span>{post.authorHandle}</span>
              <span>·</span>
              <span>{formatRelativeTime(post.createdAt)}</span>
            </div>
            {post.locationId && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>Location pinned</span>
              </div>
            )}
          </div>
        </div>

        {/* Full body */}
        {post.type === "text" && post.body && (
          <p className="text-sm leading-relaxed">{post.body}</p>
        )}
        {post.type === "link" && post.linkUrl && (
          <a
            href={post.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm text-primary transition-colors hover:bg-muted"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="truncate">{post.linkUrl}</span>
          </a>
        )}
        {post.type === "image" && (
          <div
            className="flex h-48 items-center justify-center rounded-lg text-6xl"
            style={{ backgroundColor: post.imageColor ?? "#e5e7eb" }}
          >
            {post.imageEmoji ?? "🖼️"}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bookmark className="h-3.5 w-3.5" />
            Bookmark
          </Button>
          {post.locationId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(`/map?landmark=${post.locationId}`)}
            >
              <MapPin className="h-3.5 w-3.5" />
              View on Map
            </Button>
          )}
        </div>

        {/* Comments */}
        <CommentSection
          postId={post.id}
          comments={postComments}
          onVoteComment={onVoteComment}
          onComment={onComment}
          onReply={onReply}
        />
      </div>
    </div>
  );
}
