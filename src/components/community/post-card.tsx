import { Badge } from "@/components/ui/badge";
import { MessageCircle, MapPin, ExternalLink } from "lucide-react";
import { VoteControls } from "./vote-controls";
import {
  FLAIR_COLORS,
  formatRelativeTime,
  type CommunityPost,
  type VoteDirection,
} from "@/lib/posts";

interface PostCardProps {
  post: CommunityPost;
  onSelect: () => void;
  onVote: (direction: VoteDirection) => void;
}

export function PostCard({ post, onSelect, onVote }: PostCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
      className="w-full cursor-pointer rounded-xl border bg-card text-left shadow-sm transition-colors hover:bg-accent/50"
    >
      <div className="flex gap-3 p-4">
        <VoteControls score={post.score} userVote={post.userVote} onVote={onVote} />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="font-semibold leading-tight">{post.title}</h3>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge
              variant="outline"
              style={{ borderColor: FLAIR_COLORS[post.flair], color: FLAIR_COLORS[post.flair] }}
            >
              {post.flair}
            </Badge>
            <span>{post.authorHandle}</span>
            <span>·</span>
            <span>{formatRelativeTime(post.createdAt)}</span>
            {post.locationId && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  Location
                </span>
              </>
            )}
          </div>

          {/* Body preview */}
          {post.type === "text" && post.body && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{post.body}</p>
          )}
          {post.type === "link" && post.linkUrl && (
            <div className="flex items-center gap-1 text-sm text-primary">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{post.linkUrl}</span>
            </div>
          )}
          {post.type === "image" && (
            <div
              className="flex h-24 items-center justify-center rounded-lg text-3xl"
              style={{ backgroundColor: post.imageColor ?? "#e5e7eb" }}
            >
              {post.imageEmoji ?? "🖼️"}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5" />
            <span>{post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
