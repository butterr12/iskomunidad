"use client";

import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/shared/star-rating";
import { PenLine } from "lucide-react";

interface RatingsSummaryProps {
  avgRating: number;
  reviewCount: number;
  onWriteReview: () => void;
  hasUserReview?: boolean;
}

export function RatingsSummary({
  avgRating,
  reviewCount,
  onWriteReview,
  hasUserReview,
}: RatingsSummaryProps) {
  if (reviewCount === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <p className="text-sm text-muted-foreground">
          No reviews yet. Be the first!
        </p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onWriteReview}>
          <PenLine className="h-3.5 w-3.5" />
          Write a Review
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold">{avgRating.toFixed(1)}</span>
        <div>
          <StarRating value={avgRating} size="sm" />
          <p className="text-xs text-muted-foreground">
            ({reviewCount} review{reviewCount !== 1 ? "s" : ""})
          </p>
        </div>
      </div>
      {!hasUserReview && (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onWriteReview}>
          <PenLine className="h-3.5 w-3.5" />
          Write a Review
        </Button>
      )}
    </div>
  );
}
