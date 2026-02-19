"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { AttractionDetail } from "@/components/attraction-detail";
import { useIsMobile } from "@/hooks/use-mobile";
import { getLandmarkPins, getLandmarkById } from "@/actions/landmarks";
import { getEventsForLandmark } from "@/actions/events";
import { getPostsForLandmark } from "@/actions/posts";
import type { LandmarkPin, Landmark } from "@/lib/landmarks";
import type { CampusEvent } from "@/lib/events";
import type { CommunityPost } from "@/lib/posts";

const LandmarkMap = dynamic(
  () => import("@/components/landmark-map").then((mod) => mod.LandmarkMap),
  { ssr: false }
);

interface MapPageClientProps {
  landmarkParam?: string;
}

export function MapPageClient({ landmarkParam }: MapPageClientProps) {
  const isMobile = useIsMobile();

  const [selectedIdOverride, setSelectedIdOverride] = useState<
    string | null | undefined
  >(undefined);

  const { data: pins = [] } = useQuery({
    queryKey: ["landmark-pins"],
    queryFn: async () => {
      const res = await getLandmarkPins();
      return res.success ? (res.data as LandmarkPin[]) : [];
    },
  });

  const autoSelectedId = useMemo(() => {
    if (!landmarkParam || pins.length === 0) return null;
    return pins.find((pin) => pin.id === landmarkParam)?.id ?? null;
  }, [landmarkParam, pins]);

  const selectedId =
    selectedIdOverride === undefined ? autoSelectedId : selectedIdOverride;

  const { data: selectedLandmark, isFetching: loadingDetail } = useQuery({
    queryKey: ["landmark-detail", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const res = await getLandmarkById(selectedId);
      return res.success ? (res.data as Landmark) : null;
    },
    enabled: !!selectedId,
  });

  const { data: landmarkEvents = [] } = useQuery({
    queryKey: ["landmark-events", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const res = await getEventsForLandmark(selectedId);
      if (!res.success) return [];
      return (res.data as (CampusEvent & { userRsvp?: CampusEvent["rsvpStatus"] })[]).map(
        (event) => ({
          ...event,
          rsvpStatus: event.userRsvp ?? null,
        }),
      );
    },
    enabled: !!selectedId,
  });

  const { data: landmarkPosts = [] } = useQuery({
    queryKey: ["landmark-posts", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const res = await getPostsForLandmark(selectedId);
      return res.success ? (res.data as CommunityPost[]) : [];
    },
    enabled: !!selectedId,
  });

  const handleSelectLandmark = useCallback(
    (id: string | null) => {
      setSelectedIdOverride((current) => {
        if (!id) return null;
        if (current === id) return current;
        return id;
      });
    },
    [],
  );

  const loadingSpinner = (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const detailContent = selectedLandmark && !loadingDetail ? (
    <AttractionDetail
      landmark={selectedLandmark}
      events={landmarkEvents}
      posts={landmarkPosts}
      onClose={() => setSelectedIdOverride(null)}
    />
  ) : null;

  const showPanel = selectedId !== null;

  return (
    <main className="relative flex-1 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      <div className="absolute inset-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
        <LandmarkMap
          pins={pins}
          onSelectLandmark={handleSelectLandmark}
          selectedId={selectedId}
        />
      </div>

      {showPanel && !isMobile && (
        <aside className="absolute top-12 sm:top-14 bottom-0 left-0 z-10 w-[400px] overflow-y-auto border-r bg-background shadow-xl animate-in slide-in-from-left duration-200">
          {loadingDetail ? loadingSpinner : detailContent}
        </aside>
      )}

      {showPanel && isMobile && (
        <div className="absolute bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-0 left-0 right-0 z-10 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto rounded-t-2xl border-t bg-background shadow-2xl animate-in slide-in-from-bottom duration-200">
          <div className="flex justify-center py-2">
            <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          {loadingDetail ? loadingSpinner : detailContent}
        </div>
      )}
    </main>
  );
}
