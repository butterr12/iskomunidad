import { Badge } from "@/components/ui/badge";
import { GIG_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, type GigCategory } from "@/lib/gigs";

interface CategoryFilterProps {
  activeCategory: GigCategory | null;
  onCategoryChange: (category: GigCategory | null) => void;
}

export function CategoryFilter({ activeCategory, onCategoryChange }: CategoryFilterProps) {
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
      {GIG_CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onCategoryChange(activeCategory === cat ? null : cat)}
          className="shrink-0"
        >
          <Badge
            variant={activeCategory === cat ? "default" : "outline"}
            style={
              activeCategory === cat
                ? { backgroundColor: CATEGORY_COLORS[cat], borderColor: CATEGORY_COLORS[cat] }
                : { borderColor: CATEGORY_COLORS[cat], color: CATEGORY_COLORS[cat] }
            }
          >
            {CATEGORY_LABELS[cat]}
          </Badge>
        </button>
      ))}
    </div>
  );
}
