import { Badge } from "@/components/ui/badge";
import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABELS,
  EVENT_CATEGORY_COLORS,
  type EventCategory,
} from "@/lib/events";

interface EventCategoryFilterProps {
  activeCategory: EventCategory | null;
  onCategoryChange: (category: EventCategory | null) => void;
}

export function EventCategoryFilter({ activeCategory, onCategoryChange }: EventCategoryFilterProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-4 py-2 scrollbar-none">
      <button
        onClick={() => onCategoryChange(null)}
        className="shrink-0"
      >
        <Badge variant={activeCategory === null ? "default" : "outline"}>
          All
        </Badge>
      </button>
      {EVENT_CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onCategoryChange(activeCategory === cat ? null : cat)}
          className="shrink-0"
        >
          <Badge
            variant={activeCategory === cat ? "default" : "outline"}
            style={
              activeCategory === cat
                ? { backgroundColor: EVENT_CATEGORY_COLORS[cat], borderColor: EVENT_CATEGORY_COLORS[cat] }
                : { borderColor: EVENT_CATEGORY_COLORS[cat], color: EVENT_CATEGORY_COLORS[cat] }
            }
          >
            {EVENT_CATEGORY_LABELS[cat]}
          </Badge>
        </button>
      ))}
    </div>
  );
}
