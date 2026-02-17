"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { AttractionDetail } from "@/components/attraction-detail";
import { useIsMobile } from "@/hooks/use-mobile";
import { getEventsAtLandmark } from "@/lib/events";
import { getPostsAtLandmark } from "@/lib/posts";
import { getApprovedLandmarks } from "@/actions/landmarks";
import { getApprovedEvents } from "@/actions/events";
import { getApprovedPosts } from "@/actions/posts";
import type { Landmark } from "@/lib/landmarks";
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

  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [approvedLandmarks, setApprovedLandmarks] = useState<Landmark[]>([]);
  const [approvedEvents, setApprovedEvents] = useState<CampusEvent[]>([]);
  const [approvedPosts, setApprovedPosts] = useState<CommunityPost[]>([]);

  useEffect(() => {
    Promise.all([
      getApprovedLandmarks(),
      getApprovedEvents(),
      getApprovedPosts(),
    ]).then(([landmarksRes, eventsRes, postsRes]) => {
      if (landmarksRes.success) {
        const landmarks = landmarksRes.data as Landmark[];
        setApprovedLandmarks(landmarks);

        // Auto-select landmark from URL param
        if (landmarkParam) {
          const match = landmarks.find((l) => l.id === landmarkParam);
          if (match) setSelectedLandmark(match);
        }
      }
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
  }, [landmarkParam]);

  return (
    <main className="relative flex-1 pt-12 pb-14 sm:pt-14 sm:pb-0">
      {/* Map (always fills the full area) */}
      <div className="absolute inset-0 pt-12 pb-14 sm:pt-14 sm:pb-0">
        <LandmarkMap
          landmarks={approvedLandmarks}
          onSelectLandmark={setSelectedLandmark}
          selectedId={selectedLandmark?.id}
        />
      </div>

      {/* Desktop sidebar (overlays on top of map) */}
      {selectedLandmark && !isMobile && (
        <aside className="absolute top-12 sm:top-14 bottom-0 left-0 z-10 w-[400px] overflow-y-auto border-r bg-background shadow-xl animate-in slide-in-from-left duration-200">
          <AttractionDetail
            landmark={selectedLandmark}
            events={getEventsAtLandmark(selectedLandmark.id, approvedEvents)}
            posts={getPostsAtLandmark(selectedLandmark.id, approvedPosts)}
            onClose={() => setSelectedLandmark(null)}
          />
        </aside>
      )}

      {/* Mobile bottom sheet */}
      {selectedLandmark && isMobile && (
        <div className="absolute bottom-14 sm:bottom-0 left-0 right-0 z-10 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto rounded-t-2xl border-t bg-background shadow-2xl animate-in slide-in-from-bottom duration-200">
          <div className="flex justify-center py-2">
            <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          <AttractionDetail
            landmark={selectedLandmark}
            events={getEventsAtLandmark(selectedLandmark.id, approvedEvents)}
            posts={getPostsAtLandmark(selectedLandmark.id, approvedPosts)}
            onClose={() => setSelectedLandmark(null)}
          />
        </div>
      )}
    </main>
  );
}
