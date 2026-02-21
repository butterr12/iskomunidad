"use client";

import { Button } from "@/components/ui/button";
import { ArrowBigUp, ArrowBigDown } from "lucide-react";
import type { VoteDirection } from "@/lib/posts";
import { cn } from "@/lib/utils";

interface VoteControlsProps {
  score: number;
  userVote: VoteDirection;
  onVote: (direction: VoteDirection) => void;
  size?: "default" | "sm";
}

export function VoteControls({ score, userVote, onVote, size = "default" }: VoteControlsProps) {
  const handleUpvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    onVote(userVote === 1 ? 0 : 1);
  };

  const handleDownvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    onVote(userVote === -1 ? 0 : -1);
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={handleUpvote}
        aria-label="Upvote"
        className={cn(
          "rounded-md",
          userVote === 1 ? "text-primary" : "text-muted-foreground"
        )}
      >
        <ArrowBigUp className={cn(iconSize, userVote === 1 && "fill-current")} />
      </Button>
      <span
        className={cn(
          "font-semibold tabular-nums",
          size === "sm" ? "text-xs" : "text-sm",
          userVote === 1 && "text-primary",
          userVote === -1 && "text-destructive"
        )}
      >
        {score}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={handleDownvote}
        aria-label="Downvote"
        className={cn(
          "rounded-md",
          userVote === -1 ? "text-destructive" : "text-muted-foreground"
        )}
      >
        <ArrowBigDown className={cn(iconSize, userVote === -1 && "fill-current")} />
      </Button>
    </div>
  );
}
