"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { star: 16, gap: "gap-0.5" },
  md: { star: 20, gap: "gap-0.5" },
  lg: { star: 28, gap: "gap-1" },
} as const;

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StarRating({
  value,
  onChange,
  size = "md",
  className,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);
  const interactive = !!onChange;
  const { star: starSize, gap } = SIZES[size];
  const displayValue = interactive && hoverValue > 0 ? hoverValue : value;

  return (
    <div
      className={cn("flex items-center", gap, className)}
      onMouseLeave={() => interactive && setHoverValue(0)}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = displayValue >= i;
        const halfFilled = !filled && displayValue >= i - 0.5;

        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            className={cn(
              "relative shrink-0 transition-colors",
              interactive && "cursor-pointer hover:scale-110 active:scale-95",
              !interactive && "cursor-default",
            )}
            style={{ width: starSize, height: starSize }}
            onClick={() => onChange?.(i)}
            onMouseEnter={() => interactive && setHoverValue(i)}
          >
            {/* Background (empty) star */}
            <Star
              className="absolute inset-0 text-muted-foreground/30"
              size={starSize}
              strokeWidth={1.5}
            />

            {/* Filled star */}
            {filled && (
              <Star
                className="absolute inset-0 fill-amber-400 text-amber-400"
                size={starSize}
                strokeWidth={1.5}
              />
            )}

            {/* Half star (read-only mode only) */}
            {halfFilled && !interactive && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: starSize / 2 }}
              >
                <Star
                  className="fill-amber-400 text-amber-400"
                  size={starSize}
                  strokeWidth={1.5}
                />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
