"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  GIG_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type GigCategory,
  type GigSortMode,
} from "@/lib/gigs";
import { Clock, DollarSign, Zap } from "lucide-react";

const SORT_OPTIONS = [
  { value: "newest" as GigSortMode, label: "Newest", icon: <Clock className="h-3.5 w-3.5" /> },
  { value: "pay" as GigSortMode, label: "Pay", icon: <DollarSign className="h-3.5 w-3.5" /> },
  { value: "urgency" as GigSortMode, label: "Urgency", icon: <Zap className="h-3.5 w-3.5" /> },
];

interface GigFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sortMode: GigSortMode;
  onSortModeChange: (mode: GigSortMode) => void;
  showSaved: boolean;
  onShowSavedChange: (show: boolean) => void;
  activeCategory: GigCategory | null;
  onCategoryChange: (category: GigCategory | null) => void;
  savedCount: number;
}

export function GigFilterSheet({
  open,
  onOpenChange,
  sortMode,
  onSortModeChange,
  showSaved,
  onShowSavedChange,
  activeCategory,
  onCategoryChange,
  savedCount,
}: GigFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="rounded-t-2xl px-6 pb-8 pt-3 gap-0">
        <SheetHeader className="p-0">
          <SheetTitle className="sr-only">Gig Filters</SheetTitle>
          <SheetDescription className="sr-only">
            Filter gigs by sort order, saved status, and category
          </SheetDescription>
        </SheetHeader>

        <div className="flex justify-center mb-5">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex flex-col gap-5">
          {/* Sort */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Sort</h3>
            <div className="flex gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSortModeChange(opt.value)}
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

          {/* Show */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Show</h3>
            <div className="flex gap-1.5">
              <button
                onClick={() => onShowSavedChange(false)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  !showSaved
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                onClick={() => onShowSavedChange(true)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  showSaved
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Saved
                {savedCount > 0 && (
                  <span
                    className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                      showSaved
                        ? "bg-white/25 text-primary-foreground"
                        : "bg-foreground/15 text-foreground"
                    }`}
                  >
                    {savedCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Category</h3>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => onCategoryChange(null)} className="shrink-0">
                <Badge variant={activeCategory === null ? "default" : "outline"}>All</Badge>
              </button>
              {GIG_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => onCategoryChange(activeCategory === cat ? null : cat)}
                  className="shrink-0"
                >
                  <Badge
                    variant={activeCategory === cat ? "default" : "outline"}
                    style={
                      activeCategory === cat
                        ? { backgroundColor: CATEGORY_COLORS[cat], borderColor: CATEGORY_COLORS[cat] }
                        : { borderColor: CATEGORY_COLORS[cat], color: CATEGORY_COLORS[cat] }
                    }
                  >
                    {CATEGORY_LABELS[cat]}
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
