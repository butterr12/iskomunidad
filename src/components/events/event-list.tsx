import { EventCard } from "./event-card";
import type { CampusEvent } from "@/lib/events";

interface EventListProps {
  events: CampusEvent[];
  onSelectEvent: (event: CampusEvent) => void;
}

export function EventList({ events, onSelectEvent }: EventListProps) {
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
