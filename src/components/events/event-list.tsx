import { CalendarDays } from "lucide-react";
import { EventCard } from "./event-card";
import type { CampusEvent } from "@/lib/events";

interface EventListProps {
  events: CampusEvent[];
  onSelectEvent: (event: CampusEvent) => void;
}

export function EventList({ events, onSelectEvent }: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
        <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium">No upcoming events yet</p>
        <p className="text-xs">Check back soon -- something&apos;s always happening on campus!</p>
      </div>
    );
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      {sorted.map((event) => (
        <EventCard key={event.id} event={event} onClick={() => onSelectEvent(event)} />
      ))}
    </div>
  );
}
