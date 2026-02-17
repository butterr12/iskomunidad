"use client";

import { useState } from "react";
import { ViewToggle } from "./view-toggle";
import { EventList } from "./event-list";
import { EventCalendar } from "./event-calendar";
import { EventDetail } from "./event-detail";
import { resolveLocation, type CampusEvent, type RsvpStatus } from "@/lib/events";
import { getEvents } from "@/lib/admin-store";

interface EventsTabProps {
  onViewOnMap: (event: CampusEvent) => void;
}

export function EventsTab({ onViewOnMap }: EventsTabProps) {
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedEvent, setSelectedEvent] = useState<CampusEvent | null>(null);
  const [events, setEvents] = useState<CampusEvent[]>(() =>
    getEvents().filter((e) => !e.status || e.status === "approved")
  );

  const handleRsvpChange = (eventId: string, status: RsvpStatus) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, rsvpStatus: status } : e))
    );
    if (selectedEvent?.id === eventId) {
      setSelectedEvent((prev) => (prev ? { ...prev, rsvpStatus: status } : prev));
    }
  };

  const handleSelectEvent = (event: CampusEvent) => {
    const latest = events.find((e) => e.id === event.id) ?? event;
    setSelectedEvent(latest);
  };

  const handleViewOnMap = () => {
    if (selectedEvent) {
      onViewOnMap(selectedEvent);
    }
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
            onViewOnMap={resolveLocation(selectedEvent) ? handleViewOnMap : undefined}
          />
        ) : viewMode === "list" ? (
          <EventList events={events} onSelectEvent={handleSelectEvent} />
        ) : (
          <EventCalendar events={events} onSelectEvent={handleSelectEvent} />
        )}
      </div>
    </div>
  );
}
