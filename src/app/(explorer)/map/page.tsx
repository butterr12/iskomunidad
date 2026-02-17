"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { AttractionDetail } from "@/components/attraction-detail";
import { useIsMobile } from "@/hooks/use-mobile";
import { getEventsAtLandmark } from "@/lib/events";
import { getPostsAtLandmark } from "@/lib/posts";
import { getLandmarkPins, getLandmarkById } from "@/actions/landmarks";
import { getApprovedEvents } from "@/actions/events";
import { getApprovedPosts } from "@/actions/posts";
import type { LandmarkPin, Landmark } from "@/lib/landmarks";
import type { CampusEvent } from "@/lib/events";
import type { CommunityPost } from "@/lib/posts";

const LandmarkMap = dynamic(
  () => import("@/components/landmark-map").then((mod) => mod.LandmarkMap),
  { ssr: false }
);

export default function MapPage() {
  const searchParams = useSearchParams();
  const landmarkParam = searchParams.get("landmark");
  const isMobile = useIsMobile();

  const [pins, setPins] = useState<LandmarkPin[]>([]);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [approvedEvents, setApprovedEvents] = useState<CampusEvent[]>([]);
  const [approvedPosts, setApprovedPosts] = useState<CommunityPost[]>([]);

  // Load pins + events + posts on mount
  useEffect(() => {
    Promise.all([
      getLandmarkPins(),
      getApprovedEvents(),
      getApprovedPosts(),
    ]).then(([pinsRes, eventsRes, postsRes]) => {
      if (pinsRes.success) setPins(pinsRes.data as LandmarkPin[]);
      if (eventsRes.success) {
        setApprovedEvents(
          (eventsRes.data as any[]).map((e) => ({
            ...e,
            rsvpStatus: e.userRsvp ?? null,
          }))
        );
      }
      if (postsRes.success) setApprovedPosts(postsRes.data as CommunityPost[]);
    });
  }, []);

  // Auto-select landmark from URL param once pins are loaded
  useEffect(() => {
    if (landmarkParam && pins.length > 0) {
      const match = pins.find((p) => p.id === landmarkParam);
      if (match) {
        loadLandmarkDetail(match.id);
      }
    }
  }, [landmarkParam, pins.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLandmarkDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    const res = await getLandmarkById(id);
    if (res.success) {
      setSelectedLandmark(res.data as Landmark);
    }
    setLoadingDetail(false);
  }, []);

  const handleSelectLandmark = useCallback(
    (id: string | null) => {
      if (!id) {
        setSelectedLandmark(null);
        return;
      }
      // If already selected, don't re-fetch
      if (selectedLandmark?.id === id) return;
      loadLandmarkDetail(id);
    },
    [selectedLandmark?.id, loadLandmarkDetail],
  );

  const loadingSpinner = (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const detailContent = selectedLandmark && !loadingDetail ? (
    <AttractionDetail
      landmark={selectedLandmark}
      events={getEventsAtLandmark(selectedLandmark.id, approvedEvents)}
      posts={getPostsAtLandmark(selectedLandmark.id, approvedPosts)}
      onClose={() => setSelectedLandmark(null)}
    />
  ) : null;

  const showPanel = selectedLandmark || loadingDetail;

  return (
    <main className="relative flex-1 pt-12 pb-14 sm:pt-14 sm:pb-0">
      {/* Map (always fills the full area) */}
      <div className="absolute inset-0 pt-12 pb-14 sm:pt-14 sm:pb-0">
        <LandmarkMap
          pins={pins}
          onSelectLandmark={handleSelectLandmark}
          selectedId={selectedLandmark?.id}
        />
      </div>

      {/* Desktop sidebar (overlays on top of map) */}
      {showPanel && !isMobile && (
        <aside className="absolute top-12 sm:top-14 bottom-0 left-0 z-10 w-[400px] overflow-y-auto border-r bg-background shadow-xl animate-in slide-in-from-left duration-200">
          {loadingDetail ? loadingSpinner : detailContent}
        </aside>
      )}

      {/* Mobile bottom sheet */}
      {showPanel && isMobile && (
        <div className="absolute bottom-14 sm:bottom-0 left-0 right-0 z-10 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto rounded-t-2xl border-t bg-background shadow-2xl animate-in slide-in-from-bottom duration-200">
          <div className="flex justify-center py-2">
            <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          {loadingDetail ? loadingSpinner : detailContent}
        </div>
      )}
    </main>
  );
}
