"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ViewToggle } from "./view-toggle";
import { EventList } from "./event-list";
import { EventCalendar } from "./event-calendar";
import { EventDetail } from "./event-detail";
import { MyEventsList } from "./my-events-list";
import { type CampusEvent, type RsvpStatus } from "@/lib/events";
import { getApprovedEvents, getUserEvents, rsvpToEvent } from "@/actions/events";

function EventCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="flex gap-4 p-4">
        <div className="flex w-10 shrink-0 flex-col items-center pt-0.5 gap-1">
          <Skeleton className="h-3 w-8 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-3/4 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-3 w-48 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-3 w-36 rounded" />
        </div>
      </div>
    </div>
  );
}

function EventListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function EventsTab() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedEvent, setSelectedEvent] = useState<CampusEvent | null>(null);
  const [tab, setTab] = useState<"all" | "mine">("all");

  const { data: events = [], isLoading } = useQuery({
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

  const { data: myEvents = [], isLoading: myEventsLoading } = useQuery({
    queryKey: ["my-events"],
    queryFn: async () => {
      const res = await getUserEvents();
      if (!res.success) return [];
      return res.data as CampusEvent[];
    },
    enabled: tab === "mine",
  });

  const handleRsvpChange = async (eventId: string, status: RsvpStatus) => {
    await rsvpToEvent(eventId, status);
    queryClient.setQueryData<CampusEvent[]>(["approved-events"], (old) =>
      old?.map((e) => (e.id === eventId ? { ...e, rsvpStatus: status } : e)),
    );
    if (selectedEvent?.id === eventId) {
      setSelectedEvent((prev) => (prev ? { ...prev, rsvpStatus: status } : prev));
    }
  };

  const handleSelectEvent = (event: CampusEvent) => {
    const latest = events.find((e) => e.id === event.id) ?? event;
    setSelectedEvent(latest);
  };

  return (
    <div className="flex flex-1 flex-col pt-12 pb-14 sm:pt-14 sm:pb-0">
      {/* Sticky sub-header */}
      {!selectedEvent && (
        <div className="sticky top-12 sm:top-14 z-10 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex gap-1">
              <Button
                variant={tab === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTab("all")}
              >
                All Events
              </Button>
              <Button
                variant={tab === "mine" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTab("mine")}
              >
                My Events
              </Button>
            </div>
            {tab === "all" && (
              <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedEvent ? (
          <EventDetail
            event={selectedEvent}
            onBack={() => setSelectedEvent(null)}
            onRsvpChange={handleRsvpChange}
          />
        ) : tab === "mine" ? (
          myEventsLoading ? (
            <EventListSkeleton />
          ) : (
            <MyEventsList events={myEvents} />
          )
        ) : isLoading ? (
          <EventListSkeleton />
        ) : viewMode === "list" ? (
          <EventList events={events} onSelectEvent={handleSelectEvent} />
        ) : (
          <EventCalendar events={events} onSelectEvent={handleSelectEvent} />
        )}
      </div>

      {/* FAB — only on feed view */}
      {!selectedEvent && (
        <Button
          size="icon-lg"
          className="fixed bottom-20 right-4 z-20 rounded-full shadow-lg sm:bottom-6"
          onClick={() => router.push("/events/create")}
        >
          <Plus className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
