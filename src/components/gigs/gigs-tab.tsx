/* eslint-disable */
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Bookmark, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ModeToggle } from "./mode-toggle";
import { GigFilterSheet } from "./gig-filter-sheet";
import { GigList } from "./gig-list";
import { GigDetail } from "./gig-detail";
import { SwipeDeck } from "./swipe-deck";
import {
  type GigListing,
  type GigSortMode,
} from "@/lib/gigs";
import {
  getApprovedGigs,
  swipeGig,
  expressInterestInGig,
  closeGig,
  reopenGig,
  deleteGig,
} from "@/actions/gigs";
import { useSession } from "@/lib/auth-client";
import { toast } from "sonner";
import { usePostHog } from "posthog-js/react";

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

interface GigsTabProps {
  initialGigId?: string | null;
}

export function GigsTab({ initialGigId }: GigsTabProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const { data: session } = useSession();
  const [viewMode, setViewMode] = useState<"list" | "swipe">("list");
  const [selectedGig, setSelectedGig] = useState<GigListing | null>(null);
  const [sortMode, setSortMode] = useState<GigSortMode>("newest");
  const [showSaved, setShowSaved] = useState(false);
  const [savingGigId, setSavingGigId] = useState<string | null>(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const { data: gigs = [], isLoading } = useQuery({
    queryKey: ["approved-gigs", sortMode],
    queryFn: async () => {
      const res = await getApprovedGigs({
        sort: sortMode,
      });
      if (!res.success) return [];
      return (res.data as (GigListing & {
        author?: string;
        authorHandle?: string;
        userSwipe?: GigListing["swipeAction"];
        posterId?: string;
      })[]).map((gig) => ({
        ...gig,
        posterName: gig.author ?? gig.posterName,
        posterHandle: gig.authorHandle ?? gig.posterHandle,
        swipeAction: gig.userSwipe ?? gig.swipeAction ?? null,
        posterId: gig.posterId ?? "",
      }));
    },
    staleTime: 30_000,
  });

  const savedCount = gigs.filter((g) => g.swipeAction === "saved").length;

  const activeFilterCount =
    (sortMode !== "newest" ? 1 : 0) +
    (showSaved ? 1 : 0);

  const filteredAndSorted = useMemo(() => {
    if (!showSaved) return gigs;
    return gigs.filter((g) => g.swipeAction === "saved");
  }, [gigs, showSaved]);

  const swipeGigs = useMemo(() => {
    return gigs.filter((g) => g.swipeAction === null);
  }, [gigs]);

  const handleSelectGig = (gig: GigListing) => {
    const latest = gigs.find((g) => g.id === gig.id) ?? gig;
    setSelectedGig(latest);
  };

  // Auto-select gig from ?gig= param
  useEffect(() => {
    if (!initialGigId || selectedGig || gigs.length === 0) return;
    const found = gigs.find((g) => g.id === initialGigId);
    if (found) handleSelectGig(found);
  }, [initialGigId, gigs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwipe = async (gigId: string, action: "saved" | "skipped") => {
    await swipeGig(gigId, action);
    posthog?.capture("gig_swiped", { action });
    queryClient.setQueriesData<GigListing[]>({ queryKey: ["approved-gigs"] }, (old) =>
      old?.map((g) => (g.id === gigId ? { ...g, swipeAction: action } : g)),
    );
  };

  const handleResetSwipes = async () => {
    for (const g of gigs.filter((g) => g.swipeAction !== null)) {
      await swipeGig(g.id, null);
    }
    queryClient.setQueriesData<GigListing[]>({ queryKey: ["approved-gigs"] }, (old) =>
      old?.map((g) => ({ ...g, swipeAction: null })),
    );
  };

  const handleInterest = async (gigId: string) => {
    const res = await expressInterestInGig(gigId);
    if (res.success && !res.data.alreadyInterested) {
      queryClient.setQueriesData<GigListing[]>({ queryKey: ["approved-gigs"] }, (old) =>
        old?.map((g) =>
          g.id === gigId
            ? { ...g, swipeAction: "interested", applicantCount: g.applicantCount + 1 }
            : g,
        ),
      );
      setSelectedGig((prev) =>
        prev?.id === gigId
          ? { ...prev, swipeAction: "interested", applicantCount: prev.applicantCount + 1 }
          : prev,
      );
    }
  };

  const handleSaveGig = async (gigId: string) => {
    const gig = gigs.find((g) => g.id === gigId);
    if (!gig) return;
    const newAction = gig.swipeAction === "saved" ? null : "saved";
    setSavingGigId(gigId);
    try {
      const res = await swipeGig(gigId, newAction);
      if (res.success) {
        queryClient.setQueriesData<GigListing[]>({ queryKey: ["approved-gigs"] }, (old) =>
          old?.map((g) => (g.id === gigId ? { ...g, swipeAction: newAction } : g)),
        );
        setSelectedGig((prev) =>
          prev?.id === gigId ? { ...prev, swipeAction: newAction } : prev,
        );
      } else {
        toast.error(res.error);
      }
    } finally {
      setSavingGigId(null);
    }
  };

  const handleCloseGig = async (gigId: string) => {
    const res = await closeGig(gigId);
    if (res.success) {
      queryClient.setQueriesData<GigListing[]>({ queryKey: ["approved-gigs"] }, (old) =>
        old?.map((g) => (g.id === gigId ? { ...g, isOpen: false } : g)),
      );
      setSelectedGig((prev) => (prev?.id === gigId ? { ...prev, isOpen: false } : prev));
      toast.success("Gig marked as filled.");
    } else {
      toast.error(res.error);
    }
  };

  const handleReopenGig = async (gigId: string) => {
    const res = await reopenGig(gigId);
    if (res.success) {
      queryClient.setQueriesData<GigListing[]>({ queryKey: ["approved-gigs"] }, (old) =>
        old?.map((g) => (g.id === gigId ? { ...g, isOpen: true } : g)),
      );
      setSelectedGig((prev) => (prev?.id === gigId ? { ...prev, isOpen: true } : prev));
      toast.success("Gig reopened.");
    } else {
      toast.error(res.error);
    }
  };

  const handleDeleteGig = async (gigId: string) => {
    const res = await deleteGig(gigId);
    if (res.success) {
      queryClient.setQueriesData<GigListing[]>({ queryKey: ["approved-gigs"] }, (old) =>
        old?.filter((g) => g.id !== gigId),
      );
      setSelectedGig(null);
      toast.success("Gig deleted.");
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      {/* Sticky sub-header */}
      {!selectedGig && (
        <div className="sticky top-12 sm:top-14 z-10 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-2">
            <h2 className="text-lg font-semibold">Gigs</h2>
            <div className="flex items-center gap-2">
              {viewMode === "list" && (
                <button
                  onClick={() => setShowFilterSheet(true)}
                  className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filter
                  {activeFilterCount > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              )}
              <ModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            </div>
          </div>
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
                onClick={() => router.push("/gigs/create")}
                className="w-full mb-3 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/10 px-5 py-4 text-left transition-[background-color,border-color,transform] hover:from-emerald-500/20 hover:via-emerald-500/10 hover:border-emerald-500/20 active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold">Need help with something?</p>
                </div>
              </button>
            )}

            {selectedGig ? (
              <GigDetail
                gig={selectedGig}
                onBack={() => setSelectedGig(null)}
                isOwner={!!session?.user && session.user.id === selectedGig.posterId}
                onInterest={() => handleInterest(selectedGig.id)}
                isInterested={selectedGig.swipeAction === "interested"}
                onSave={() => handleSaveGig(selectedGig.id)}
                isSaved={selectedGig.swipeAction === "saved"}
                isSaving={savingGigId === selectedGig.id}
                onClose={session?.user?.id === selectedGig.posterId ? () => handleCloseGig(selectedGig.id) : undefined}
                onReopen={session?.user?.id === selectedGig.posterId ? () => handleReopenGig(selectedGig.id) : undefined}
                onDelete={session?.user?.id === selectedGig.posterId ? () => handleDeleteGig(selectedGig.id) : undefined}
                onEdit={session?.user?.id === selectedGig.posterId ? () => router.push(`/gigs/${selectedGig.id}/edit`) : undefined}
              />
            ) : isLoading ? (
              <GigListSkeleton />
            ) : viewMode === "list" ? (
              filteredAndSorted.length === 0 && showSaved ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
                  <Bookmark className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">No saved gigs</p>
                  <p className="text-xs">Swipe right or tap &ldquo;Save&rdquo; on a gig to bookmark it here.</p>
                </div>
              ) : (
                <GigList
                  gigs={filteredAndSorted}
                  onSelectGig={handleSelectGig}
                  currentUserId={session?.user?.id}
                />
              )
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
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4 z-20 rounded-full shadow-lg sm:bottom-6"
          onClick={() => router.push("/gigs/create")}
        >
          <Plus className="h-5 w-5" />
        </Button>
      )}

      <GigFilterSheet
        open={showFilterSheet}
        onOpenChange={setShowFilterSheet}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        showSaved={showSaved}
        onShowSavedChange={setShowSaved}
        savedCount={savedCount}
      />
    </div>
  );
}
