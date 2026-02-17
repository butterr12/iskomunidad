import { Button } from "@/components/ui/button";
import { Clock, DollarSign, Zap } from "lucide-react";
import type { GigSortMode } from "@/lib/gigs";

interface SortToggleProps {
  sortMode: GigSortMode;
  onSortModeChange: (mode: GigSortMode) => void;
}

const modes: { value: GigSortMode; label: string; icon: React.ReactNode }[] = [
  { value: "newest", label: "New", icon: <Clock /> },
  { value: "pay", label: "Pay", icon: <DollarSign /> },
  { value: "urgency", label: "Urgent", icon: <Zap /> },
];

export function SortToggle({ sortMode, onSortModeChange }: SortToggleProps) {
  return (
    <div className="flex rounded-lg bg-muted p-1">
      {modes.map((m) => (
        <Button
          key={m.value}
          size="xs"
          variant={sortMode === m.value ? "default" : "ghost"}
          onClick={() => onSortModeChange(m.value)}
          className="gap-1"
        >
          {m.icon}
          {m.label}
        </Button>
      ))}
    </div>
  );
}
