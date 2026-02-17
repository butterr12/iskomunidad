"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CalendarDays, Users, Search, X } from "lucide-react";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedEvent, setSelectedEvent] = useState<CampusEvent | null>(null);
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.organizer.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [events, searchQuery]);

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
        <div className="mx-auto w-full max-w-5xl p-4">
          {/* Welcome banner + search */}
          {!selectedEvent && tab === "all" && (
            <div className="mb-4 rounded-2xl bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/10 px-5 py-4">
              <p className="text-base font-semibold">What&apos;s happening on campus?</p>
              <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {events.length} upcoming {events.length === 1 ? "event" : "events"}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  Campus Events
                </span>
              </div>
              {/* Search bar */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events by title, organizer, or tags..."
                  className="w-full rounded-lg border bg-background py-2 pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-violet-500/30"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

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
            <EventList events={filteredEvents} onSelectEvent={handleSelectEvent} />
          ) : (
            <EventCalendar events={filteredEvents} onSelectEvent={handleSelectEvent} />
          )}
        </div>
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
