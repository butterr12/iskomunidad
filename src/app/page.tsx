"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSession } from "@/lib/auth-client";
import { NavBar } from "@/components/nav-bar";
import { AttractionDetail } from "@/components/attraction-detail";
import { EventsTab } from "@/components/events/events-tab";
import { CommunityTab } from "@/components/community/community-tab";
import { GigsTab } from "@/components/gigs/gigs-tab";
import { useIsMobile } from "@/hooks/use-mobile";
import { eventToLandmark, getEventsAtLandmark } from "@/lib/events";
import { postToLandmark, getPostsAtLandmark } from "@/lib/posts";
import { gigToLandmark } from "@/lib/gigs";
import { getApprovedLandmarks } from "@/actions/landmarks";
import { getApprovedEvents } from "@/actions/events";
import { getApprovedPosts } from "@/actions/posts";
import type { NavTab } from "@/components/nav-bar";
import type { Landmark } from "@/lib/landmarks";
import type { CampusEvent } from "@/lib/events";
import type { CommunityPost } from "@/lib/posts";
import type { GigListing } from "@/lib/gigs";

const LandmarkMap = dynamic(
  () => import("@/components/landmark-map").then((mod) => mod.LandmarkMap),
  { ssr: false }
);

export default function Home() {
  const { isPending } = useSession();
  const [activeTab, setActiveTab] = useState<NavTab>("map");
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const isMobile = useIsMobile();

  const [approvedLandmarks, setApprovedLandmarks] = useState<Landmark[]>([]);
  const [approvedEvents, setApprovedEvents] = useState<CampusEvent[]>([]);
  const [approvedPosts, setApprovedPosts] = useState<CommunityPost[]>([]);

  useEffect(() => {
    Promise.all([
      getApprovedLandmarks(),
      getApprovedEvents(),
      getApprovedPosts(),
    ]).then(([landmarksRes, eventsRes, postsRes]) => {
      if (landmarksRes.success) setApprovedLandmarks(landmarksRes.data as Landmark[]);
      if (eventsRes.success) {
        setApprovedEvents((eventsRes.data as any[]).map((e) => ({
          ...e,
          rsvpStatus: e.userRsvp ?? null,
        })));
      }
      if (postsRes.success) setApprovedPosts(postsRes.data as CommunityPost[]);
    });
  }, []);

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    setSelectedLandmark(null);
  };

  const handleViewOnMap = (event: CampusEvent) => {
    const landmark = eventToLandmark(event, approvedLandmarks);
    if (landmark) {
      setActiveTab("map");
      setSelectedLandmark(landmark);
    }
  };

  const handleViewOnMapFromPost = (post: CommunityPost) => {
    const landmark = postToLandmark(post, approvedLandmarks);
    if (landmark) {
      setActiveTab("map");
      setSelectedLandmark(landmark);
    }
  };

  const handleViewOnMapFromGig = (gig: GigListing) => {
    const landmark = gigToLandmark(gig, approvedLandmarks);
    if (landmark) {
      setActiveTab("map");
      setSelectedLandmark(landmark);
    }
  };

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <NavBar activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === "map" ? (
        <main className="relative flex flex-1 pt-12 pb-14 sm:pt-14 sm:pb-0">
          {/* Desktop sidebar */}
          {selectedLandmark && !isMobile && (
            <aside className="w-[400px] shrink-0 overflow-y-auto border-r bg-background animate-in slide-in-from-left duration-200">
              <AttractionDetail
                landmark={selectedLandmark}
                events={getEventsAtLandmark(selectedLandmark.id, approvedEvents)}
                posts={getPostsAtLandmark(selectedLandmark.id, approvedPosts)}
                onClose={() => setSelectedLandmark(null)}
              />
            </aside>
          )}

          {/* Map */}
          <div className="flex-1">
            <LandmarkMap
              landmarks={approvedLandmarks}
              onSelectLandmark={setSelectedLandmark}
              selectedId={selectedLandmark?.id}
            />
          </div>

          {/* Mobile bottom sheet */}
          {selectedLandmark && isMobile && (
            <div className="absolute bottom-14 sm:bottom-0 left-0 right-0 z-50 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto rounded-t-2xl border-t bg-background shadow-2xl animate-in slide-in-from-bottom duration-200">
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
      ) : activeTab === "events" ? (
        <main className="flex flex-1 flex-col">
          <EventsTab onViewOnMap={handleViewOnMap} />
        </main>
      ) : activeTab === "gigs" ? (
        <main className="flex flex-1 flex-col">
          <GigsTab onViewOnMap={handleViewOnMapFromGig} />
        </main>
      ) : (
        <main className="flex flex-1 flex-col">
          <CommunityTab onViewOnMap={handleViewOnMapFromPost} />
        </main>
      )}
    </div>
  );
}
