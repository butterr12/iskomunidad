import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EventCard } from "./event-card";
import type { CampusEvent } from "@/lib/events";

interface EventCalendarProps {
  events: CampusEvent[];
  onSelectEvent: (event: CampusEvent) => void;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(date: Date) {
  return isSameDay(date, new Date());
}

export function EventCalendar({ events, onSelectEvent }: EventCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const eventsByDay = new Map<number, CampusEvent[]>();
  for (const event of events) {
    const d = new Date(event.startDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventsByDay.has(day)) eventsByDay.set(day, []);
      eventsByDay.get(day)!.push(event);
    }
  }

  const selectedDayEvents =
    selectedDay && selectedDay.getFullYear() === year && selectedDay.getMonth() === month
      ? eventsByDay.get(selectedDay.getDate()) ?? []
      : [];

  const monthLabel = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <Button variant="ghost" size="icon-sm" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = new Date(year, month, day);
          const dayEvents = eventsByDay.get(day);
          const hasDayEvents = !!dayEvents && dayEvents.length > 0;
          const isSelected = selectedDay ? isSameDay(selectedDay, date) : false;
          const today = isToday(date);

          return (
            <button
              key={day}
              onClick={() => {
                if (hasDayEvents) setSelectedDay(date);
              }}
              className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-sm transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : today
                    ? "ring-1 ring-primary/40"
                    : hasDayEvents
                      ? "hover:bg-accent"
                      : "text-muted-foreground/60"
              }`}
            >
              <span>{day}</span>
              {hasDayEvents && (
                <div className="flex gap-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: isSelected ? "white" : ev.coverColor,
                      }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day's events */}
      {selectedDayEvents.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <h4 className="text-xs font-medium text-muted-foreground">
            {selectedDay!.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h4>
          {selectedDayEvents.map((event) => (
            <EventCard key={event.id} event={event} onClick={() => onSelectEvent(event)} />
          ))}
        </div>
      )}
    </div>
  );
}
