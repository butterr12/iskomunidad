"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Heart, RotateCcw, Loader2 } from "lucide-react";
import { MatchCard } from "./match-card";
import type { MatchProfileCard, MatchResult } from "@/actions/match";
import { recordSwipe } from "@/actions/match";
import { toast } from "sonner";

interface MatchSwipeDeckProps {
  cards: MatchProfileCard[];
  swipesRemaining: number;
  swipeLimit: number;
  onMatch: (result: Extract<MatchResult, { matched: true }>) => void;
  onDeckEmpty: () => void;
}

export function MatchSwipeDeck({
  cards,
  swipesRemaining: initialRemaining,
  swipeLimit,
  onMatch,
  onDeckEmpty,
}: MatchSwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [flyDirection, setFlyDirection] = useState<"left" | "right" | null>(null);
  const [directionLocked, setDirectionLocked] = useState<"horizontal" | "vertical" | null>(null);
  const [swiping, setSwiping] = useState(false);

  const startPos = useRef({ x: 0, y: 0 });
  const SWIPE_THRESHOLD = 100;

  const currentCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];

  const handleSwipeAction = useCallback(
    async (direction: "like" | "pass") => {
      if (!currentCard || isAnimatingOut || swiping) return;
      if (remaining <= 0) {
        toast.error("No swipes remaining today");
        return;
      }

      setSwiping(true);
      setFlyDirection(direction === "like" ? "right" : "left");
      setIsAnimatingOut(true);

      const result = await recordSwipe({
        targetId: currentCard.userId,
        direction,
      });

      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setRemaining((prev) => prev - 1);
        setOffsetX(0);
        setIsAnimatingOut(false);
        setFlyDirection(null);
        setSwiping(false);

        if (result.success && result.data.matched) {
          onMatch(result.data as Extract<MatchResult, { matched: true }>);
        }

        if (currentIndex + 1 >= cards.length) {
          onDeckEmpty();
        }
      }, 300);

      if (!result.success) {
        toast.error(result.error);
      }
    },
    [currentCard, isAnimatingOut, swiping, remaining, currentIndex, cards.length, onMatch, onDeckEmpty],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isAnimatingOut || swiping) return;
      setIsDragging(true);
      setDirectionLocked(null);
      startPos.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isAnimatingOut, swiping],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || isAnimatingOut) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;

      if (!directionLocked) {
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          setDirectionLocked(Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical");
        }
        return;
      }

      if (directionLocked === "horizontal") {
        e.preventDefault();
        setOffsetX(dx);
      }
    },
    [isDragging, isAnimatingOut, directionLocked],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    setDirectionLocked(null);

    if (Math.abs(offsetX) > SWIPE_THRESHOLD) {
      void handleSwipeAction(offsetX > 0 ? "like" : "pass");
    } else {
      setOffsetX(0);
    }
  }, [isDragging, offsetX, handleSwipeAction]);

  if (currentIndex >= cards.length || remaining <= 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Heart className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {remaining <= 0 ? "No swipes remaining" : "No more profiles"}
          </p>
          <p className="text-xs text-muted-foreground max-w-[220px]">
            {remaining <= 0
              ? "Your daily swipe limit resets at midnight. Check back tomorrow!"
              : "Check back later for new profiles!"}
          </p>
        </div>
      </div>
    );
  }

  const rotation = offsetX * 0.05;
  const likeOpacity = Math.min(Math.max(offsetX / SWIPE_THRESHOLD, 0), 1);
  const passOpacity = Math.min(Math.max(-offsetX / SWIPE_THRESHOLD, 0), 1);

  const cardStyle = isAnimatingOut
    ? {
        transform: `translateX(${flyDirection === "right" ? 500 : -500}px) rotate(${flyDirection === "right" ? 25 : -25}deg)`,
        transition: "transform 300ms ease-out",
      }
    : {
        transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
        transition: isDragging ? "none" : "transform 300ms ease-out",
      };

  return (
    <div className="flex flex-1 flex-col items-center gap-3 px-4 pb-4 pt-2">
      {/* Progress */}
      <p className="text-xs text-muted-foreground">
        {remaining} swipe{remaining !== 1 ? "s" : ""} remaining today
      </p>

      {/* Card stack */}
      <div className="relative h-[380px] w-full max-w-[320px]">
        {nextCard && (
          <div
            className="absolute inset-0"
            style={{ transform: "scale(0.95)", opacity: 0.6 }}
          >
            <MatchCard card={nextCard} />
          </div>
        )}

        {currentCard && (
          <div
            className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
            style={cardStyle}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Like overlay */}
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-4 border-pink-500 bg-pink-500/10"
              style={{ opacity: likeOpacity }}
            >
              <span className="rotate-[-15deg] text-4xl font-black text-pink-500">
                LIKE
              </span>
            </div>
            {/* Pass overlay */}
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-4 border-muted-foreground/40 bg-muted/20"
              style={{ opacity: passOpacity }}
            >
              <span className="rotate-[15deg] text-4xl font-black text-muted-foreground">
                PASS
              </span>
            </div>

            <MatchCard card={currentCard} />
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-6 mt-1">
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-muted-foreground/30 text-muted-foreground hover:bg-muted"
          onClick={() => void handleSwipeAction("pass")}
          disabled={isAnimatingOut || swiping}
        >
          <X className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-pink-300 text-pink-500 hover:bg-pink-50 hover:text-pink-600 dark:hover:bg-pink-950"
          onClick={() => void handleSwipeAction("like")}
          disabled={isAnimatingOut || swiping}
        >
          <Heart className="h-5 w-5" />
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground/50">
        identity hidden until you both match
      </p>
    </div>
  );
}
