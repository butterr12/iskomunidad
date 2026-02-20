import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, MapPin, ExternalLink } from "lucide-react";
import { VoteControls } from "./vote-controls";
import { UserFlairs } from "@/components/user-flairs";
import {
  FLAIR_COLORS,
  formatRelativeTime,
  type CommunityPost,
  type VoteDirection,
} from "@/lib/posts";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
      className="w-full cursor-pointer rounded-2xl border bg-card text-left shadow-sm transition-all hover:bg-accent/50 hover:shadow-md hover:scale-[1.01]"
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
            <Avatar className="h-5 w-5">
              {post.authorImage && <AvatarImage src={post.authorImage} alt={post.author} />}
              <AvatarFallback className="text-[9px] font-medium">{getInitials(post.author)}</AvatarFallback>
            </Avatar>
            {post.authorHandle ? (
              <Link
                href={`/profile/${post.authorHandle.replace("@", "")}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:underline hover:text-foreground"
              >
                {post.authorHandle}
              </Link>
            ) : (
              <span>{post.author}</span>
            )}
            <UserFlairs username={post.authorHandle?.replace("@", "") ?? ""} context="inline" max={1} />
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
          {post.body && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{post.body}</p>
          )}
          {post.linkUrl && (
            <div className="flex items-center gap-1 text-sm text-primary">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{post.linkUrl}</span>
            </div>
          )}
          {post.imageKeys && post.imageKeys.length > 0 && (
            <div className="relative h-48 overflow-hidden rounded-lg">
              <Image
                src={`/api/photos/${post.imageKeys[0]}`}
                alt="Post image"
                fill
                unoptimized
                sizes="(max-width: 640px) 100vw, 600px"
                className="object-cover"
              />
              {post.imageKeys.length > 1 && (
                <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                  +{post.imageKeys.length - 1}
                </div>
              )}
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
