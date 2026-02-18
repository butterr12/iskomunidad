import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Clock, DollarSign, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GigSortMode } from "@/lib/gigs";

interface SortToggleProps {
  sortMode: GigSortMode;
  onSortModeChange: (mode: GigSortMode) => void;
}

const modes: { value: GigSortMode; label: string; Icon: LucideIcon }[] = [
  { value: "newest", label: "New", Icon: Clock },
  { value: "pay", label: "Pay", Icon: DollarSign },
  { value: "urgency", label: "Urgent", Icon: Zap },
];

export function SortToggle({ sortMode, onSortModeChange }: SortToggleProps) {
  const current = modes.find((m) => m.value === sortMode)!;

  return (
    <>
      {/* Mobile: compact select */}
      <div className="sm:hidden">
        <Select value={sortMode} onValueChange={onSortModeChange}>
          <SelectTrigger size="sm">
            <current.Icon className="size-4" />
            {current.label}
          </SelectTrigger>
          <SelectContent>
            {modes.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                <m.Icon className="size-4" />
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: pill toggle */}
      <div className="hidden sm:flex rounded-lg bg-muted p-1">
        {modes.map((m) => (
          <Button
            key={m.value}
            size="xs"
            variant={sortMode === m.value ? "default" : "ghost"}
            onClick={() => onSortModeChange(m.value)}
            className="gap-1"
          >
            <m.Icon />
            {m.label}
          </Button>
        ))}
      </div>
    </>
  );
}
