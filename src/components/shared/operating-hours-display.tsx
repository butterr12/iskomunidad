"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OperatingHours } from "@/lib/landmarks";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const SHORT_LABELS: Record<(typeof DAYS)[number], string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return m === "00" ? `${h12} ${ampm}` : `${h12}:${m} ${ampm}`;
}

function getCurrentDay(): (typeof DAYS)[number] {
  const jsDay = new Date().getDay(); // 0=Sunday
  return DAYS[jsDay === 0 ? 6 : jsDay - 1];
}

function isCurrentlyOpen(hours: OperatingHours): boolean {
  const today = getCurrentDay();
  const todayHours = hours[today];
  if (!todayHours) return false;

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return currentTime >= todayHours.open && currentTime < todayHours.close;
}

interface GroupedDay {
  days: (typeof DAYS)[number][];
  hours: { open: string; close: string } | null;
}

function groupDays(hours: OperatingHours): GroupedDay[] {
  const groups: GroupedDay[] = [];

  for (const day of DAYS) {
    const dayHours = hours[day];
    const last = groups[groups.length - 1];
    if (
      last &&
      ((last.hours === null && dayHours === null) ||
        (last.hours &&
          dayHours &&
          last.hours.open === dayHours.open &&
          last.hours.close === dayHours.close))
    ) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], hours: dayHours });
    }
  }

  return groups;
}

function formatDayRange(days: (typeof DAYS)[number][]): string {
  if (days.length === 1) return DAY_LABELS[days[0]];
  return `${SHORT_LABELS[days[0]]}-${SHORT_LABELS[days[days.length - 1]]}`;
}

interface OperatingHoursDisplayProps {
  hours: OperatingHours;
}

export function OperatingHoursDisplay({ hours }: OperatingHoursDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const open = isCurrentlyOpen(hours);
  const today = getCurrentDay();
  const groups = groupDays(hours);

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm"
      >
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className={cn("font-medium", open ? "text-green-600" : "text-red-500")}>
          {open ? "Open now" : "Closed"}
        </span>
        {hours[today] && (
          <span className="text-muted-foreground">
            · {formatTime(hours[today]!.open)} - {formatTime(hours[today]!.close)}
          </span>
        )}
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="ml-6 space-y-0.5">
          {groups.map((group, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between text-xs",
                group.days.includes(today) && "font-medium text-foreground",
                !group.days.includes(today) && "text-muted-foreground",
              )}
            >
              <span className="w-24">{formatDayRange(group.days)}</span>
              <span>
                {group.hours
                  ? `${formatTime(group.hours.open)} - ${formatTime(group.hours.close)}`
                  : "Closed"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
