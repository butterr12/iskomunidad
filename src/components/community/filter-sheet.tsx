"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { POST_FLAIRS, FLAIR_COLORS, type PostFlair, type SortMode } from "@/lib/posts";
import { Clock, Flame, TrendingUp } from "lucide-react";

const SORT_OPTIONS: { value: SortMode; label: string; icon: React.ReactNode }[] = [
  { value: "new", label: "New", icon: <Clock className="h-3.5 w-3.5" /> },
  { value: "hot", label: "Hot", icon: <Flame className="h-3.5 w-3.5" /> },
  { value: "top", label: "Top", icon: <TrendingUp className="h-3.5 w-3.5" /> },
];

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  feedMode: "all" | "following";
  onFeedModeChange: (mode: "all" | "following") => void;
  activeFlair: PostFlair | null;
  onFlairChange: (flair: PostFlair | null) => void;
  showFeedMode: boolean;
}

export function FilterSheet({
  open,
  onOpenChange,
  sortMode,
  onSortModeChange,
  feedMode,
  onFeedModeChange,
  activeFlair,
  onFlairChange,
  showFeedMode,
}: FilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-2xl px-6 pb-8 pt-3 gap-0"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="sr-only">Filters</SheetTitle>
          <SheetDescription className="sr-only">
            Filter community posts by sort, feed, and flair
          </SheetDescription>
        </SheetHeader>

        {/* Drag indicator pill */}
        <div className="flex justify-center mb-5">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex flex-col gap-5">
          {/* Sort section */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Sort</h3>
            <div className="flex gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onSortModeChange(opt.value);
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    sortMode === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feed section */}
          {showFeedMode && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Feed</h3>
              <div className="flex gap-1.5">
                {(["all", "following"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      onFeedModeChange(mode);
                    }}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                      feedMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "all" ? "All" : "Following"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Flair section */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Flair</h3>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => { onFlairChange(null); }}>
                <Badge variant={activeFlair === null ? "default" : "outline"}>
                  All
                </Badge>
              </button>
              {POST_FLAIRS.map((flair) => (
                <button
                  key={flair}
                  onClick={() => {
                    onFlairChange(activeFlair === flair ? null : flair);
                  }}
                >
                  <Badge
                    variant={activeFlair === flair ? "default" : "outline"}
                    style={
                      activeFlair === flair
                        ? { backgroundColor: FLAIR_COLORS[flair], borderColor: FLAIR_COLORS[flair] }
                        : { borderColor: FLAIR_COLORS[flair], color: FLAIR_COLORS[flair] }
                    }
                  >
                    {flair}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
