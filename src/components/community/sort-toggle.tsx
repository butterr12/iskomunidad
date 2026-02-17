import { Button } from "@/components/ui/button";
import { Flame, Clock, TrendingUp } from "lucide-react";
import type { SortMode } from "@/lib/posts";

interface SortToggleProps {
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
}

const modes: { value: SortMode; label: string; icon: React.ReactNode }[] = [
  { value: "hot", label: "Hot", icon: <Flame /> },
  { value: "new", label: "New", icon: <Clock /> },
  { value: "top", label: "Top", icon: <TrendingUp /> },
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
