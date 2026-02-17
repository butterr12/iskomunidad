"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewToggle } from "./view-toggle";
import { EventList } from "./event-list";
import { EventCalendar } from "./event-calendar";
import { EventDetail } from "./event-detail";
import { type CampusEvent, type RsvpStatus } from "@/lib/events";
import { getApprovedEvents, rsvpToEvent } from "@/actions/events";

function EventCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="h-[3px] rounded-t-2xl bg-muted" />
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
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedEvent, setSelectedEvent] = useState<CampusEvent | null>(null);

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
        <div className="sticky top-12 sm:top-14 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-2 backdrop-blur-sm">
          <h2 className="text-lg font-semibold">Events</h2>
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
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
        ) : isLoading ? (
          <EventListSkeleton />
        ) : viewMode === "list" ? (
          <EventList events={events} onSelectEvent={handleSelectEvent} />
        ) : (
          <EventCalendar events={events} onSelectEvent={handleSelectEvent} />
        )}
      </div>
    </div>
  );
}
