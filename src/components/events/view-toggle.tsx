import { Button } from "@/components/ui/button";
import { List, Calendar } from "lucide-react";

interface ViewToggleProps {
  viewMode: "list" | "calendar";
  onViewModeChange: (mode: "list" | "calendar") => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
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
        variant={viewMode === "calendar" ? "default" : "ghost"}
        onClick={() => onViewModeChange("calendar")}
        className="gap-1"
      >
        <Calendar />
        Calendar
      </Button>
    </div>
  );
}
