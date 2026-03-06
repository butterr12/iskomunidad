"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Heart, X, Loader2 } from "lucide-react";
import { MatchCard } from "./match-card";
import type { MatchProfileCard, MatchResult } from "@/actions/match";
import { recordSwipe } from "@/actions/match";
import { toast } from "sonner";

interface LikesYouFeedProps {
  cards: MatchProfileCard[];
  onMatch: (result: Extract<MatchResult, { matched: true }>) => void;
}

export function LikesYouFeed({ cards: initialCards, onMatch }: LikesYouFeedProps) {
  const [cards, setCards] = useState(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const currentCard = cards[currentIndex];

  const handleAction = useCallback(
    async (direction: "like" | "pass") => {
      if (!currentCard || swiping) return;
      setSwiping(true);

      const result = await recordSwipe({
        targetId: currentCard.userId,
        direction,
      });

      if (result.success && result.data.matched) {
        onMatch(result.data as Extract<MatchResult, { matched: true }>);
      } else if (!result.success) {
        toast.error(result.error);
      }

      setCurrentIndex((prev) => prev + 1);
      setSwiping(false);
    },
    [currentCard, swiping, onMatch],
  );

  if (!currentCard || currentIndex >= cards.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No more pending likes right now
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 px-4 pb-4">
      <p className="text-xs text-muted-foreground">
        {cards.length - currentIndex} {cards.length - currentIndex === 1 ? "person likes" : "people like"} you
      </p>

      <div className="w-full max-w-[320px]">
        <MatchCard card={currentCard} />
      </div>

      <div className="flex items-center gap-6 mt-2">
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-muted-foreground/30 text-muted-foreground hover:bg-muted"
          onClick={() => void handleAction("pass")}
          disabled={swiping}
        >
          {swiping ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-5 w-5" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-pink-300 text-pink-500 hover:bg-pink-50 hover:text-pink-600 dark:hover:bg-pink-950"
          onClick={() => void handleAction("like")}
          disabled={swiping}
        >
          {swiping ? <Loader2 className="h-5 w-5 animate-spin" /> : <Heart className="h-5 w-5" />}
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground/60">
        Like back for an instant match
      </p>
    </div>
  );
}
