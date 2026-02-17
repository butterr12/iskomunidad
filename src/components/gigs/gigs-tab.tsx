"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark } from "lucide-react";
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

interface GigsTabProps {
  onViewOnMap: (gig: GigListing) => void;
}

export function GigsTab({ onViewOnMap }: GigsTabProps) {
  const [viewMode, setViewMode] = useState<"list" | "swipe">("list");
  const [selectedGig, setSelectedGig] = useState<GigListing | null>(null);
  const [gigs, setGigs] = useState<GigListing[]>([]);
  const [activeCategory, setActiveCategory] = useState<GigCategory | null>(null);
  const [sortMode, setSortMode] = useState<GigSortMode>("newest");
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    getApprovedGigs().then((res) => {
      if (res.success) {
        setGigs((res.data as any[]).map((g) => ({
          ...g,
          posterName: g.author ?? g.posterName,
          posterHandle: g.authorHandle ?? g.posterHandle,
          swipeAction: g.userSwipe ?? g.swipeAction ?? null,
        })));
      }
    });
  }, []);

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
    setGigs((prev) =>
      prev.map((g) => (g.id === gigId ? { ...g, swipeAction: action } : g))
    );
  };

  const handleResetSwipes = async () => {
    // Reset all swipes locally and on server
    for (const g of gigs.filter((g) => g.swipeAction !== null)) {
      await swipeGig(g.id, null);
    }
    setGigs((prev) => prev.map((g) => ({ ...g, swipeAction: null })));
  };

  const handleViewOnMap = () => {
    if (selectedGig) {
      onViewOnMap(selectedGig);
    }
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
            onViewOnMap={selectedGig.locationId ? handleViewOnMap : undefined}
          />
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
