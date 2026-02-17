"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "@/lib/auth-client";
import { NavBar } from "@/components/nav-bar";
import { AttractionDetail } from "@/components/attraction-detail";
import { useIsMobile } from "@/hooks/use-mobile";
import { landmarks } from "@/lib/landmarks";
import type { NavTab } from "@/components/nav-bar";
import type { Landmark } from "@/lib/landmarks";
import { MapPin, Users, CalendarDays } from "lucide-react";

const LandmarkMap = dynamic(
  () => import("@/components/landmark-map").then((mod) => mod.LandmarkMap),
  { ssr: false }
);

export default function Home() {
  const { isPending } = useSession();
  const [activeTab, setActiveTab] = useState<NavTab>("map");
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const isMobile = useIsMobile();

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    setSelectedLandmark(null);
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
        <main className="relative flex flex-1 pt-14">
          {/* Desktop sidebar */}
          {selectedLandmark && !isMobile && (
            <aside className="w-[400px] shrink-0 overflow-y-auto border-r bg-background animate-in slide-in-from-left duration-200">
              <AttractionDetail
                landmark={selectedLandmark}
                onClose={() => setSelectedLandmark(null)}
              />
            </aside>
          )}

          {/* Map */}
          <div className="flex-1">
            <LandmarkMap
              landmarks={landmarks}
              onSelectLandmark={setSelectedLandmark}
              selectedId={selectedLandmark?.id}
            />
          </div>

          {/* Mobile bottom sheet */}
          {selectedLandmark && isMobile && (
            <div className="absolute bottom-0 left-0 right-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t bg-background shadow-2xl animate-in slide-in-from-bottom duration-200">
              <div className="flex justify-center py-2">
                <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
              </div>
              <AttractionDetail
                landmark={selectedLandmark}
                onClose={() => setSelectedLandmark(null)}
              />
            </div>
          )}
        </main>
      ) : (
        <main className="flex flex-1 items-center justify-center pt-14">
          <div className="text-center text-muted-foreground">
            {activeTab === "community" ? (
              <Users className="mx-auto mb-3 h-10 w-10" />
            ) : (
              <CalendarDays className="mx-auto mb-3 h-10 w-10" />
            )}
            <p className="text-lg font-medium">
              {activeTab === "community" ? "Community" : "Events"}
            </p>
            <p className="text-sm">Coming soon</p>
          </div>
        </main>
      )}
    </div>
  );
}
