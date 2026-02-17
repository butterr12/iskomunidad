import { Clock, MapPin, Globe } from "lucide-react";
import { resolveLocation, type CampusEvent } from "@/lib/events";

interface EventCardProps {
  event: CampusEvent;
  onClick: () => void;
}

function formatEventTime(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayStr = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const startTime = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dayStr} · ${startTime} - ${endTime}`;
}

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : n.toLocaleString();
}

export function EventCard({ event, onClick }: EventCardProps) {
  const start = new Date(event.startDate);
  const month = start.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = start.getDate();
  const location = resolveLocation(event);

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border bg-card text-left shadow-sm transition-colors hover:bg-accent/50"
    >
      <div className="h-[3px] rounded-t-xl" style={{ backgroundColor: event.coverColor }} />
      <div className="flex gap-4 p-4">
        <div className="flex w-10 shrink-0 flex-col items-center pt-0.5">
          <span className="text-[10px] font-semibold leading-none text-muted-foreground">
            {month}
          </span>
          <span className="text-xl font-bold leading-tight">{day}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="truncate font-semibold leading-tight">{event.title}</h3>
          <p className="text-xs text-muted-foreground">{event.organizer}</p>

          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">{formatEventTime(event.startDate, event.endDate)}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {location ? (
              <>
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{location.name}</span>
              </>
            ) : (
              <>
                <Globe className="h-3 w-3 shrink-0" />
                <span>Online Event</span>
              </>
            )}
          </div>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatCount(event.attendeeCount)} going · {formatCount(event.interestedCount)} interested
          </p>
        </div>
      </div>
    </button>
  );
}
