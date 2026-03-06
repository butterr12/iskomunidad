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
import {
  type CampusEvent,
  type RsvpStatus,
} from "@/lib/events";
import { getApprovedEvents, getUserEvents, rsvpToEvent } from "@/actions/events";
import { usePostHog } from "posthog-js/react";

function EventCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <Skeleton className="h-36 w-full" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <Skeleton className="h-3 w-2/3 rounded" />
        <Skeleton className="h-3 w-1/3 rounded" />
      </div>
    </div>
  );
}

function EventListSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function EventsTab() {
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "mine">("all");
  const router = useRouter();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["approved-events"],
    queryFn: async () => {
      const res = await getApprovedEvents();
      if (!res.success) return [];
      return (res.data as (CampusEvent & { userRsvp?: RsvpStatus })[]).map(
        (event) => ({
          ...event,
          rsvpStatus: event.userRsvp ?? null,
        }),
      );
    },
    staleTime: 30_000,
  });

  const { data: myEvents = [], isLoading: myEventsLoading } = useQuery({
    queryKey: ["my-events"],
    queryFn: async () => {
      const res = await getUserEvents();
      if (!res.success) return [];
      return res.data as CampusEvent[];
    },
    enabled: tab === "mine",
    staleTime: 30_000,
  });

  // Derive selected event from local selection ID so RSVP updates flow
  // through the query cache without duplicating event state.
  const selectedEvent = selectedEventId
    ? events.find((e) => e.id === selectedEventId) ?? null
    : null;

  const handleRsvpChange = async (eventId: string, status: RsvpStatus) => {
    await rsvpToEvent(eventId, status);
    posthog?.capture("event_rsvp", { status });
    queryClient.setQueryData<CampusEvent[]>(["approved-events"], (old) =>
      old?.map((e) => (e.id === eventId ? { ...e, rsvpStatus: status } : e)),
    );
  };

  const handleSelectEvent = (event: CampusEvent) => {
    setSelectedEventId(event.id);
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
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
        <div className="mx-auto w-full max-w-5xl p-4">

          {/* Welcome banner */}
          {!selectedEvent && tab === "all" && (
            <div className="mb-4 rounded-2xl bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/10 px-5 py-4">
              <p className="text-base font-semibold">What&apos;s happening on campus?</p>
            </div>
          )}

          {selectedEvent ? (
            <EventDetail
              event={selectedEvent}
              onBack={() => setSelectedEventId(null)}
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
      </div>

      {/* FAB — only on feed view */}
      {!selectedEvent && (
        <Button
          size="icon-lg"
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4 z-20 rounded-full shadow-lg sm:bottom-6"
          onClick={() => router.push("/events/create")}
        >
          <Plus className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
