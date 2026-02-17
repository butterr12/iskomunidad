"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: pins = [] } = useQuery({
    queryKey: ["landmark-pins"],
    queryFn: async () => {
      const res = await getLandmarkPins();
      return res.success ? (res.data as LandmarkPin[]) : [];
    },
  });

  const { data: approvedEvents = [] } = useQuery({
    queryKey: ["approved-events"],
    queryFn: async () => {
      const res = await getApprovedEvents();
      if (!res.success) return [];
      return (res.data as any[]).map((e) => ({
        ...e,
        rsvpStatus: e.userRsvp ?? null,
      })) as CampusEvent[];
    },
  });

  const { data: approvedPosts = [] } = useQuery({
    queryKey: ["approved-posts"],
    queryFn: async () => {
      const res = await getApprovedPosts();
      return res.success ? (res.data as CommunityPost[]) : [];
    },
  });

  const { data: selectedLandmark, isFetching: loadingDetail } = useQuery({
    queryKey: ["landmark-detail", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const res = await getLandmarkById(selectedId);
      return res.success ? (res.data as Landmark) : null;
    },
    enabled: !!selectedId,
  });

  // Auto-select landmark from URL param once pins are loaded
  useEffect(() => {
    if (landmarkParam && pins.length > 0) {
      const match = pins.find((p) => p.id === landmarkParam);
      if (match) setSelectedId(match.id);
    }
  }, [landmarkParam, pins]);

  const handleSelectLandmark = useCallback(
    (id: string | null) => {
      if (!id) {
        setSelectedId(null);
        return;
      }
      if (selectedId === id) return;
      setSelectedId(id);
    },
    [selectedId],
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
      onClose={() => setSelectedId(null)}
    />
  ) : null;

  const showPanel = selectedId !== null;

  return (
    <main className="relative flex-1 pt-12 pb-14 sm:pt-14 sm:pb-0">
      {/* Map (always fills the full area) */}
      <div className="absolute inset-0 pt-12 pb-14 sm:pt-14 sm:pb-0">
        <LandmarkMap
          pins={pins}
          onSelectLandmark={handleSelectLandmark}
          selectedId={selectedId}
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
