/* eslint-disable */
"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Bookmark, Info, RotateCcw } from "lucide-react";
import { SwipeCard } from "./swipe-card";
import type { GigListing } from "@/lib/gigs";

interface SwipeDeckProps {
  gigs: GigListing[];
  onSwipe: (gigId: string, action: "saved" | "skipped") => void;
  onSelectGig: (gig: GigListing) => void;
  onReset: () => void;
}

export function SwipeDeck({ gigs, onSwipe, onSelectGig, onReset }: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [flyDirection, setFlyDirection] = useState<"left" | "right" | null>(null);
  const [directionLocked, setDirectionLocked] = useState<"horizontal" | "vertical" | null>(null);

  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });

  const SWIPE_THRESHOLD = 100;

  const currentGig = gigs[currentIndex];
  const nextGig = gigs[currentIndex + 1];

  const handleSwipeAction = useCallback(
    (action: "saved" | "skipped") => {
      if (!currentGig || isAnimatingOut) return;
      setFlyDirection(action === "saved" ? "right" : "left");
      setIsAnimatingOut(true);
      setTimeout(() => {
        onSwipe(currentGig.id, action);
        setCurrentIndex((prev) => prev + 1);
        setOffsetX(0);
        setIsAnimatingOut(false);
        setFlyDirection(null);
      }, 300);
    },
    [currentGig, isAnimatingOut, onSwipe]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isAnimatingOut) return;
      setIsDragging(true);
      setDirectionLocked(null);
      startPos.current = { x: e.clientX, y: e.clientY };
      currentPos.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isAnimatingOut]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || isAnimatingOut) return;
      currentPos.current = { x: e.clientX, y: e.clientY };
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
    [isDragging, isAnimatingOut, directionLocked]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    setDirectionLocked(null);

    if (Math.abs(offsetX) > SWIPE_THRESHOLD) {
      handleSwipeAction(offsetX > 0 ? "saved" : "skipped");
    } else {
      setOffsetX(0);
    }
  }, [isDragging, offsetX, handleSwipeAction]);

  // Empty state
  if (currentIndex >= gigs.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-semibold">No more gigs!</p>
        <p className="text-sm text-muted-foreground">
          You&apos;ve gone through all available gigs.
        </p>
        <Button variant="outline" className="gap-2" onClick={onReset}>
          <RotateCcw className="h-4 w-4" />
          Start Over
        </Button>
      </div>
    );
  }

  const rotation = offsetX * 0.05;
  const saveOpacity = Math.min(Math.max(offsetX / SWIPE_THRESHOLD, 0), 1);
  const skipOpacity = Math.min(Math.max(-offsetX / SWIPE_THRESHOLD, 0), 1);

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
    <div className="flex flex-1 flex-col items-center gap-4 px-4 pb-4 pt-2">
      {/* Progress */}
      <p className="text-xs text-muted-foreground">
        {currentIndex + 1} / {gigs.length}
      </p>

      {/* Card stack */}
      <div className="relative h-[420px] w-full max-w-[340px]">
        {/* Next card (behind) */}
        {nextGig && (
          <div
            className="absolute inset-0"
            style={{ transform: "scale(0.95)", opacity: 0.6 }}
          >
            <SwipeCard gig={nextGig} />
          </div>
        )}

        {/* Current card */}
        {currentGig && (
          <div
            className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
            style={cardStyle}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Overlay indicators */}
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-4 border-green-500 bg-green-500/10"
              style={{ opacity: saveOpacity }}
            >
              <span className="rotate-[-15deg] text-4xl font-black text-green-500">SAVE</span>
            </div>
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-4 border-red-500 bg-red-500/10"
              style={{ opacity: skipOpacity }}
            >
              <span className="rotate-[15deg] text-4xl font-black text-red-500">SKIP</span>
            </div>

            <SwipeCard gig={currentGig} />
          </div>
        )}
      </div>

      {/* Button controls */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-red-300 text-red-500 hover:bg-red-50 hover:text-red-600"
          onClick={() => handleSwipeAction("skipped")}
          disabled={isAnimatingOut}
        >
          <X className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={() => currentGig && onSelectGig(currentGig)}
        >
          <Info className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-green-300 text-green-500 hover:bg-green-50 hover:text-green-600"
          onClick={() => handleSwipeAction("saved")}
          disabled={isAnimatingOut}
        >
          <Bookmark className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
