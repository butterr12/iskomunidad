"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StarRating } from "@/components/shared/star-rating";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { LandmarkReview } from "@/lib/landmarks";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface ReviewListProps {
  reviews: LandmarkReview[];
  currentUserId?: string | null;
  onEdit?: (review: LandmarkReview) => void;
  onDelete?: (reviewId: string) => void;
  maxVisible?: number;
}

export function ReviewList({
  reviews,
  currentUserId,
  onEdit,
  onDelete,
  maxVisible,
}: ReviewListProps) {
  const [showAll, setShowAll] = useState(false);
  const visible =
    maxVisible && !showAll ? reviews.slice(0, maxVisible) : reviews;
  const hasMore = maxVisible ? reviews.length > maxVisible : false;

  if (reviews.length === 0) return null;

  return (
    <div className="space-y-3">
      {visible.map((review) => {
        const isOwn = currentUserId === review.userId;
        return (
          <div key={review.id} className="flex gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              {review.authorImage && (
                <AvatarImage src={review.authorImage} alt="" />
              )}
              <AvatarFallback className="text-xs">
                {(review.author ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">
                    {review.author ?? "Anonymous"}
                  </span>
                  {review.authorHandle && (
                    <span className="text-xs text-muted-foreground">
                      {review.authorHandle}
                    </span>
                  )}
                </div>
                {isOwn && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(review)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onDelete?.(review.id)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StarRating value={review.rating} size="sm" />
                <span className="text-xs text-muted-foreground">
                  {timeAgo(review.createdAt)}
                </span>
              </div>
              {review.body && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                  {review.body}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {hasMore && !showAll && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-primary"
          onClick={() => setShowAll(true)}
        >
          See all {reviews.length} reviews
        </Button>
      )}
    </div>
  );
}
