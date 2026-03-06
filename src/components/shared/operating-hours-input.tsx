"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Copy } from "lucide-react";
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
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const DEFAULT_HOURS = { open: "08:00", close: "17:00" };

interface OperatingHoursInputProps {
  value: OperatingHours;
  onChange: (hours: OperatingHours) => void;
}

export function OperatingHoursInput({
  value,
  onChange,
}: OperatingHoursInputProps) {
  const updateDay = (
    day: (typeof DAYS)[number],
    data: { open: string; close: string } | null,
  ) => {
    onChange({ ...value, [day]: data });
  };

  const copyToAll = () => {
    const firstOpen = DAYS.map((d) => value[d]).find((v) => v !== null);
    const hours = firstOpen ?? DEFAULT_HOURS;
    const newValue = {} as OperatingHours;
    for (const day of DAYS) {
      newValue[day] = { ...hours };
    }
    onChange(newValue);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Operating Hours</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={copyToAll}
        >
          <Copy className="h-3 w-3" />
          Copy to all
        </Button>
      </div>

      {DAYS.map((day) => {
        const isOpen = value[day] !== null;
        const hours = value[day] ?? DEFAULT_HOURS;

        return (
          <div key={day} className="flex items-center gap-3">
            <span className="w-10 text-sm font-medium text-muted-foreground">
              {DAY_LABELS[day]}
            </span>
            <Switch
              checked={isOpen}
              onCheckedChange={(checked) =>
                updateDay(day, checked ? { ...DEFAULT_HOURS } : null)
              }
            />
            {isOpen ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={hours.open}
                  onChange={(e) =>
                    updateDay(day, { ...hours, open: e.target.value })
                  }
                  className="h-8 w-[120px] text-sm"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="time"
                  value={hours.close}
                  onChange={(e) =>
                    updateDay(day, { ...hours, close: e.target.value })
                  }
                  className="h-8 w-[120px] text-sm"
                />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function getDefaultOperatingHours(): OperatingHours {
  const hours = {} as OperatingHours;
  for (const day of DAYS) {
    hours[day] = { open: "08:00", close: "17:00" };
  }
  return hours;
}
