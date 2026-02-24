"use client";

import { useState, useRef, useCallback } from "react";
import {
  HeartHandshake,
  X,
  Heart,
  RotateCcw,
  Cpu,
  Palette,
  FlaskConical,
  Globe,
  TrendingUp,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface MockProfile {
  id: string;
  college: string;
  year: string;
  interests: string[];
  prompt: string;
  answer: string;
  color: string;
  Icon: LucideIcon;
}

const MOCK_PROFILES: MockProfile[] = [
  {
    id: "1",
    college: "College of Engineering",
    year: "3rd year",
    interests: ["3D Printing", "Hackathons", "Coffee"],
    prompt: "My love language is...",
    answer: "debugging your code at 2am",
    color: "#6366f1",
    Icon: Cpu,
  },
  {
    id: "2",
    college: "College of Arts and Letters",
    year: "2nd year",
    interests: ["Film", "Poetry", "Thrifting"],
    prompt: "You'll win me over with...",
    answer: "recommending me a weird movie",
    color: "#ec4899",
    Icon: Palette,
  },
  {
    id: "3",
    college: "College of Science",
    year: "4th year",
    interests: ["Astronomy", "Hiking", "Matcha"],
    prompt: "Current situationship with...",
    answer: "my thesis",
    color: "#10b981",
    Icon: FlaskConical,
  },
  {
    id: "4",
    college: "College of Social Sciences",
    year: "1st year",
    interests: ["Activism", "Zines", "Jazz"],
    prompt: "Unpopular opinion:",
    answer: "library is the best hangout spot on campus",
    color: "#f59e0b",
    Icon: Globe,
  },
  {
    id: "5",
    college: "College of Business Administration",
    year: "3rd year",
    interests: ["Startups", "Podcasts", "Running"],
    prompt: "My biggest red flag:",
    answer: "I treat case studies like Netflix binges",
    color: "#3b82f6",
    Icon: TrendingUp,
  },
];

function ProfileCard({ profile }: { profile: MockProfile }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border bg-card shadow-lg overflow-hidden">
      <div className="h-2 shrink-0" style={{ backgroundColor: profile.color }} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Avatar + college */}
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: profile.color + "20" }}
          >
            <profile.Icon
              className="h-5 w-5"
              style={{ color: profile.color }}
            />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {profile.college}
            </p>
            <p className="text-sm font-semibold">{profile.year}</p>
          </div>
        </div>

        {/* Interests */}
        <div className="flex flex-wrap gap-1.5">
          {profile.interests.map((interest) => (
            <Badge key={interest} variant="secondary" className="text-xs">
              {interest}
            </Badge>
          ))}
        </div>

        {/* Prompt card */}
        <div className="mt-auto rounded-xl border bg-muted/30 p-3">
          <p className="text-[11px] text-muted-foreground mb-1">
            {profile.prompt}
          </p>
          <p className="text-sm font-medium leading-snug">
            &ldquo;{profile.answer}&rdquo;
          </p>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/50">
          identity hidden until you both match
        </p>
      </div>
    </div>
  );
}

interface MatchPreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MatchPreviewSheet({
  open,
  onOpenChange,
}: MatchPreviewSheetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [flyDirection, setFlyDirection] = useState<"left" | "right" | null>(
    null
  );
  const [directionLocked, setDirectionLocked] = useState<
    "horizontal" | "vertical" | null
  >(null);

  const startPos = useRef({ x: 0, y: 0 });
  const SWIPE_THRESHOLD = 100;

  const currentProfile = MOCK_PROFILES[currentIndex];
  const nextProfile = MOCK_PROFILES[currentIndex + 1];

  const handleSwipeAction = useCallback(
    (action: "like" | "pass") => {
      if (!currentProfile || isAnimatingOut) return;
      setFlyDirection(action === "like" ? "right" : "left");
      setIsAnimatingOut(true);
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setOffsetX(0);
        setIsAnimatingOut(false);
        setFlyDirection(null);
      }, 300);
    },
    [currentProfile, isAnimatingOut]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isAnimatingOut) return;
      setIsDragging(true);
      setDirectionLocked(null);
      startPos.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isAnimatingOut]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || isAnimatingOut) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;

      if (!directionLocked) {
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          setDirectionLocked(
            Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical"
          );
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
      handleSwipeAction(offsetX > 0 ? "like" : "pass");
    } else {
      setOffsetX(0);
    }
  }, [isDragging, offsetX, handleSwipeAction]);

  const handleReset = () => {
    setCurrentIndex(0);
    setOffsetX(0);
    setIsAnimatingOut(false);
    setFlyDirection(null);
  };

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

  const isDone = currentIndex >= MOCK_PROFILES.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-2xl px-4 pb-8 pt-3 gap-0"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="sr-only">Campus Match Preview</SheetTitle>
          <SheetDescription className="sr-only">
            Interactive preview of the Campus Match feature
          </SheetDescription>
        </SheetHeader>

        {/* Drag indicator */}
        <div className="flex justify-center mb-4">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex flex-col items-center gap-1 mb-4">
          <div className="flex items-center gap-2">
            <HeartHandshake className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Campus Match</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Coming soon
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-[220px]">
            Match with fellow iskos anonymously. Connect when you&apos;re both
            ready.
          </p>
        </div>

        {isDone ? (
          /* Empty state */
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <HeartHandshake className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">You&apos;re all caught up!</p>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                Real profiles coming soon. Stay tuned for Campus Match.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleReset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              See again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {/* Progress */}
            <p className="text-xs text-muted-foreground">
              {currentIndex + 1} / {MOCK_PROFILES.length}
            </p>

            {/* Card stack */}
            <div className="relative h-[290px] w-full max-w-[320px]">
              {nextProfile && (
                <div
                  key={nextProfile.id}
                  className="absolute inset-0"
                  style={{ transform: "scale(0.95)", opacity: 0.6 }}
                >
                  <ProfileCard profile={nextProfile} />
                </div>
              )}

              {currentProfile && (
                <div
                  key={currentProfile.id}
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

                  <ProfileCard profile={currentProfile} />
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-6 mt-1">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                onClick={() => handleSwipeAction("pass")}
                disabled={isAnimatingOut}
              >
                <X className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full border-pink-300 text-pink-500 hover:bg-pink-50 hover:text-pink-600 dark:hover:bg-pink-950"
                onClick={() => handleSwipeAction("like")}
                disabled={isAnimatingOut}
              >
                <Heart className="h-5 w-5" />
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground/50">
              🔒 identity hidden · reveal only when you both match
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
