"use client";

import { Badge } from "@/components/ui/badge";
import type { MatchProfileCard } from "@/actions/match";

// Palette of visually distinct, accessible accent colors
const ACCENT_PALETTE = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6",
  "#8b5cf6", "#f97316", "#14b8a6", "#e11d48", "#0ea5e9",
  "#84cc16", "#a855f7", "#06b6d4", "#f43f5e", "#22d3ee",
];

/** Derive a stable color from any string via simple hash */
function getCollegeColor(college: string | null): string {
  if (!college) return "#6b7280";
  let hash = 0;
  for (let i = 0; i < college.length; i++) {
    hash = ((hash << 5) - hash + college.charCodeAt(i)) | 0;
  }
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length];
}

export function MatchCard({ card }: { card: MatchProfileCard }) {
  const color = getCollegeColor(card.college);

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-card shadow-lg overflow-hidden">
      <div className="h-2 shrink-0" style={{ backgroundColor: color }} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* College + year */}
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-full flex items-center justify-center shrink-0 text-lg font-bold"
            style={{ backgroundColor: color + "20", color }}
          >
            ?
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {card.college ?? "University"}
            </p>
            {card.year && <p className="text-sm font-semibold">{card.year}</p>}
          </div>
        </div>

        {/* Interests */}
        <div className="flex flex-wrap gap-1.5">
          {card.interests.map((interest) => (
            <Badge key={interest} variant="secondary" className="text-xs">
              {interest}
            </Badge>
          ))}
        </div>

        {/* Prompt cards */}
        <div className="flex flex-col gap-2 mt-auto">
          {card.prompts.map((prompt, i) => (
            <div key={i} className="rounded-xl border bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground mb-1">
                {prompt.promptText}
              </p>
              <p className="text-sm font-medium leading-snug">
                &ldquo;{prompt.answer}&rdquo;
              </p>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-muted-foreground/50">
          identity hidden until you both match
        </p>
      </div>
    </div>
  );
}
