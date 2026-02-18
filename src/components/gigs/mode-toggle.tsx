import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { List, Layers } from "lucide-react";

interface ModeToggleProps {
  viewMode: "list" | "swipe";
  onViewModeChange: (mode: "list" | "swipe") => void;
}

const modes = [
  { value: "list" as const, label: "List", Icon: List },
  { value: "swipe" as const, label: "Swipe", Icon: Layers },
];

export function ModeToggle({ viewMode, onViewModeChange }: ModeToggleProps) {
  const current = modes.find((m) => m.value === viewMode)!;

  return (
    <>
      {/* Mobile: compact select */}
      <div className="sm:hidden">
        <Select value={viewMode} onValueChange={onViewModeChange}>
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
        <Button
          size="xs"
          variant={viewMode === "list" ? "default" : "ghost"}
          onClick={() => onViewModeChange("list")}
          className="gap-1"
        >
          <List />
          List
        </Button>
        <Button
          size="xs"
          variant={viewMode === "swipe" ? "default" : "ghost"}
          onClick={() => onViewModeChange("swipe")}
          className="gap-1"
        >
          <Layers />
          Swipe
        </Button>
      </div>
    </>
  );
}
