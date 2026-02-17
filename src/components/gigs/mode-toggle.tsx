import { Button } from "@/components/ui/button";
import { List, Layers } from "lucide-react";

interface ModeToggleProps {
  viewMode: "list" | "swipe";
  onViewModeChange: (mode: "list" | "swipe") => void;
}

export function ModeToggle({ viewMode, onViewModeChange }: ModeToggleProps) {
  return (
    <div className="flex rounded-lg bg-muted p-1">
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
  );
}
