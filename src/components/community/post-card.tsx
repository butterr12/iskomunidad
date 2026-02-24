"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MessageCircle, MapPin, ExternalLink, MoreHorizontal, Pencil, Trash2, CalendarDays } from "lucide-react";
import { VoteControls } from "./vote-controls";
import { UserFlairs } from "@/components/user-flairs";
import { MentionText } from "./mention-text";
import { TagChips } from "@/components/shared/tag-chips";
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

function isEdited(post: CommunityPost): boolean {
  if (!post.updatedAt) return false;
  return new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 5000;
}

interface PostCardProps {
  post: CommunityPost;
  currentUserId?: string | null;
  onSelect: () => void;
  onVote: (direction: VoteDirection) => void;
  onEdit?: (post: CommunityPost) => void;
  onDelete?: (postId: string) => void;
}

export function PostCard({ post, currentUserId, onSelect, onVote, onEdit, onDelete }: PostCardProps) {
  const isAuthor = !!currentUserId && currentUserId === post.userId;
  const [menuOpen, setMenuOpen] = useState(false);
  const eventColor = post.eventId && post.eventTitle && post.eventColor
    ? post.eventColor
    : undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
      className="relative w-full cursor-pointer rounded-2xl border bg-card text-left shadow-sm transition-[transform,box-shadow,background-color] hover:bg-accent/50 hover:shadow-md hover:scale-[1.01]"
      style={eventColor ? { borderColor: eventColor } : undefined}
    >
      {eventColor && post.eventTitle && (
        <div className="absolute bottom-0 right-0" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/events?event=${post.eventId}`}
            className="flex items-center gap-1 rounded-br-2xl rounded-tl-xl px-3 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: eventColor }}
          >
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span className="max-w-[140px] truncate">{post.eventTitle}</span>
          </Link>
        </div>
      )}
      <div className="flex gap-3 p-4">
        <VoteControls score={post.score} userVote={post.userVote} onVote={onVote} />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start gap-2">
            <h3 className="flex-1 font-semibold leading-tight">{post.title}</h3>
            {isAuthor && (
              <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Post options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-32 p-1"
                  align="end"
                  side="bottom"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onEdit?.(post);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete?.(post.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </PopoverContent>
              </Popover>
            )}
          </div>

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
            {isEdited(post) && (
              <span className="text-muted-foreground/70">(edited)</span>
            )}
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
            <p className="line-clamp-2 text-sm text-muted-foreground">
              <MentionText
                text={post.body}
                onMentionClick={(e) => e.stopPropagation()}
              />
            </p>
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

          {/* Tags */}
          <TagChips
            tags={post.tags ?? []}
            maxVisible={4}
            onTagClick={(e) => e.stopPropagation()}
          />

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
