import { Clock, MapPin, Globe, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  EVENT_CATEGORY_LABELS,
  EVENT_CATEGORY_COLORS,
  type CampusEvent,
} from "@/lib/events";

interface EventCardProps {
  event: CampusEvent;
  onClick: () => void;
}

function formatEventTime(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startTime = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${startTime} – ${endTime}`;
}

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : n.toLocaleString();
}

export function EventCard({ event, onClick }: EventCardProps) {
  const start = new Date(event.startDate);
  const month = start.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = start.getDate();
  const weekday = start.toLocaleDateString("en-US", { weekday: "short" });

  return (
    <button
      onClick={onClick}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-all hover:shadow-lg hover:scale-[1.02]"
    >
      {/* Large cover area */}
      <div
        className="relative flex h-36 items-end p-4"
        style={{ backgroundColor: event.coverColor }}
      >
        {/* Category badge */}
        <Badge
          className="absolute top-3 left-3 text-[10px] text-white border-0"
          style={{ backgroundColor: EVENT_CATEGORY_COLORS[event.category] + "cc" }}
        >
          {EVENT_CATEGORY_LABELS[event.category]}
        </Badge>

        {/* Date chip */}
        <div className="absolute top-3 right-3 flex flex-col items-center rounded-xl bg-white/90 dark:bg-black/70 px-2.5 py-1.5 shadow-sm">
          <span className="text-[10px] font-bold leading-none text-muted-foreground">{month}</span>
          <span className="text-lg font-extrabold leading-tight">{day}</span>
          <span className="text-[10px] leading-none text-muted-foreground">{weekday}</span>
        </div>

        {/* Title overlay */}
        <h3 className="relative z-10 text-base font-bold leading-snug text-white drop-shadow-md line-clamp-2">
          {event.title}
        </h3>

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      </div>

      {/* Info area */}
      <div className="flex flex-col gap-1.5 p-4">
        <p className="text-xs font-medium text-foreground">{event.organizer}</p>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{formatEventTime(event.startDate, event.endDate)}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {event.locationId ? (
            <>
              <MapPin className="h-3 w-3 shrink-0" />
              <span>On Campus</span>
            </>
          ) : (
            <>
              <Globe className="h-3 w-3 shrink-0" />
              <span>Online Event</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3 w-3 shrink-0" />
          <span>{formatCount(event.attendeeCount)} going · {formatCount(event.interestedCount)} interested</span>
        </div>
      </div>
    </button>
  );
}
