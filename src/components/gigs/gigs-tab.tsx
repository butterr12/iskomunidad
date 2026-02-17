"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SortToggle } from "./sort-toggle";
import { CategoryFilter } from "./category-filter";
import { ModeToggle } from "./mode-toggle";
import { GigList } from "./gig-list";
import { GigDetail } from "./gig-detail";
import { SwipeDeck } from "./swipe-deck";
import {
  sortGigs,
  type GigListing,
  type GigCategory,
  type GigSortMode,
} from "@/lib/gigs";
import { getApprovedGigs, swipeGig } from "@/actions/gigs";

function GigCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl border bg-card p-3 shadow-sm">
      <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/4 rounded" />
        <div className="flex gap-1">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-2/3 rounded" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-3 w-8 rounded ml-auto" />
        </div>
      </div>
    </div>
  );
}

function GigListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <GigCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function GigsTab() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"list" | "swipe">("list");
  const [selectedGig, setSelectedGig] = useState<GigListing | null>(null);
  const [activeCategory, setActiveCategory] = useState<GigCategory | null>(null);
  const [sortMode, setSortMode] = useState<GigSortMode>("newest");
  const [showSaved, setShowSaved] = useState(false);

  const { data: gigs = [], isLoading } = useQuery({
    queryKey: ["approved-gigs"],
    queryFn: async () => {
      const res = await getApprovedGigs();
      if (!res.success) return [];
      return (res.data as any[]).map((g) => ({
        ...g,
        posterName: g.author ?? g.posterName,
        posterHandle: g.authorHandle ?? g.posterHandle,
        swipeAction: g.userSwipe ?? g.swipeAction ?? null,
      })) as GigListing[];
    },
  });

  const savedCount = useMemo(
    () => gigs.filter((g) => g.swipeAction === "saved").length,
    [gigs]
  );

  const filteredAndSorted = useMemo(() => {
    let filtered = gigs;
    if (activeCategory) {
      filtered = filtered.filter((g) => g.category === activeCategory);
    }
    if (showSaved) {
      filtered = filtered.filter((g) => g.swipeAction === "saved");
    }
    return sortGigs(filtered, sortMode);
  }, [gigs, activeCategory, sortMode, showSaved]);

  const swipeGigs = useMemo(() => {
    let filtered = gigs.filter((g) => g.swipeAction === null);
    if (activeCategory) {
      filtered = filtered.filter((g) => g.category === activeCategory);
    }
    return filtered;
  }, [gigs, activeCategory]);

  const handleSelectGig = (gig: GigListing) => {
    const latest = gigs.find((g) => g.id === gig.id) ?? gig;
    setSelectedGig(latest);
  };

  const handleSwipe = async (gigId: string, action: "saved" | "skipped") => {
    await swipeGig(gigId, action);
    queryClient.setQueryData<GigListing[]>(["approved-gigs"], (old) =>
      old?.map((g) => (g.id === gigId ? { ...g, swipeAction: action } : g)),
    );
  };

  const handleResetSwipes = async () => {
    for (const g of gigs.filter((g) => g.swipeAction !== null)) {
      await swipeGig(g.id, null);
    }
    queryClient.setQueryData<GigListing[]>(["approved-gigs"], (old) =>
      old?.map((g) => ({ ...g, swipeAction: null })),
    );
  };

  return (
    <div className="flex flex-1 flex-col pt-12 pb-14 sm:pt-14 sm:pb-0">
      {/* Sticky sub-header */}
      {!selectedGig && (
        <div className="sticky top-12 sm:top-14 z-10 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Gigs</h2>
              <Button
                variant={showSaved ? "default" : "ghost"}
                size="xs"
                className="gap-1"
                onClick={() => setShowSaved(!showSaved)}
              >
                <Bookmark className="h-3.5 w-3.5" />
                Saved
                {savedCount > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                    {savedCount}
                  </Badge>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {viewMode === "list" && (
                <SortToggle sortMode={sortMode} onSortModeChange={setSortMode} />
              )}
              <ModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            </div>
          </div>
          {viewMode === "list" && (
            <CategoryFilter activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 overflow-y-auto flex-col">
        {selectedGig ? (
          <GigDetail
            gig={selectedGig}
            onBack={() => setSelectedGig(null)}
          />
        ) : isLoading ? (
          <GigListSkeleton />
        ) : viewMode === "list" ? (
          <GigList gigs={filteredAndSorted} onSelectGig={handleSelectGig} />
        ) : (
          <SwipeDeck
            gigs={swipeGigs}
            onSwipe={handleSwipe}
            onSelectGig={handleSelectGig}
            onReset={handleResetSwipes}
          />
        )}
      </div>
    </div>
  );
}
