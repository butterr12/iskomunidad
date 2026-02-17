"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, Plus, Hammer, Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateGigForm } from "./create-gig-form";
import { SortToggle } from "./sort-toggle";
import { CategoryFilter } from "./category-filter";
import { ModeToggle } from "./mode-toggle";
import { GigList } from "./gig-list";
import { GigDetail } from "./gig-detail";
import { SwipeDeck } from "./swipe-deck";
import {
  sortGigs,
  GIG_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type GigListing,
  type GigCategory,
  type GigSortMode,
} from "@/lib/gigs";
import { getApprovedGigs, swipeGig, createGig } from "@/actions/gigs";
import { toast } from "sonner";

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
    <div className="space-y-3">
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
  const [showCreateGig, setShowCreateGig] = useState(false);

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

  const handleCreateGig = async (data: Parameters<typeof createGig>[0]) => {
    const res = await createGig(data);
    if (res.success) {
      await queryClient.invalidateQueries({ queryKey: ["approved-gigs"] });
      toast.success("Gig posted!");
    } else {
      toast.error(res.error);
    }
    return { success: res.success };
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
          {/* Category filter visible only on mobile */}
          {viewMode === "list" && (
            <div className="lg:hidden">
              <CategoryFilter activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
            </div>
          )}
        </div>
      )}

      {/* Reddit-style two-column layout */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl gap-4 p-4">
          {/* Main feed column */}
          <div className="min-w-0 flex-1 max-w-2xl mx-auto lg:mx-0">
            {/* Welcome banner */}
            {!selectedGig && (
              <button
                onClick={() => setShowCreateGig(true)}
                className="w-full mb-3 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/10 px-5 py-4 text-left transition-all hover:from-emerald-500/20 hover:via-emerald-500/10 hover:border-emerald-500/20 active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold">Need help with something?</p>
                  <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Hammer className="h-3.5 w-3.5" />
                      {gigs.length} {gigs.length === 1 ? "gig" : "gigs"} available
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      Gig Board
                    </span>
                  </div>
                </div>
              </button>
            )}

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

          {/* Right sidebar - hidden on mobile */}
          {!selectedGig && (
            <aside className="hidden lg:flex w-72 shrink-0 flex-col gap-4">
              {/* Category filter */}
              <div className="rounded-2xl border bg-card shadow-sm">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Filter by Category</h3>
                </div>
                <div className="flex flex-wrap gap-1.5 p-3">
                  <button onClick={() => setActiveCategory(null)} className="shrink-0">
                    <Badge variant={activeCategory === null ? "default" : "outline"}>All</Badge>
                  </button>
                  {GIG_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
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

              {/* Gig Board Rules */}
              <div className="rounded-2xl border bg-card shadow-sm">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Gig Board Rules</h3>
                </div>
                <ol className="flex flex-col gap-2.5 p-4 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">1.</span>
                    <span>All gigs must be legitimate and relevant to UP campus life.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">2.</span>
                    <span>Clearly state compensation. Paid gigs must include the exact amount in PHP.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">3.</span>
                    <span>Do not post misleading or exploitative job offers.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">4.</span>
                    <span>One posting per gig. No duplicate or spam listings.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">5.</span>
                    <span>Include a valid contact method so interested applicants can reach you.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">6.</span>
                    <span>Respect applicants&apos; privacy. Do not share their info without consent.</span>
                  </li>
                </ol>
              </div>

              {/* About */}
              <div className="rounded-2xl border bg-card shadow-sm">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">About Gig Board</h3>
                </div>
                <div className="flex flex-col gap-2 p-4 text-xs text-muted-foreground">
                  <p>Find side gigs, tutoring opportunities, errands, and volunteer work posted by fellow iskos and campus organizations.</p>
                  <div className="mt-1 flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Hammer className="h-3.5 w-3.5" />
                      {gigs.length} gigs
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      Gig Board
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* FAB */}
      {!selectedGig && (
        <Button
          size="icon-lg"
          className="fixed bottom-20 right-4 z-20 rounded-full shadow-lg sm:bottom-6"
          onClick={() => setShowCreateGig(true)}
        >
          <Plus className="h-5 w-5" />
        </Button>
      )}

      {/* Create gig sheet */}
      <CreateGigForm
        open={showCreateGig}
        onOpenChange={setShowCreateGig}
        onSubmit={handleCreateGig}
      />
    </div>
  );
}
