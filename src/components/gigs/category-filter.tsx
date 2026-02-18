import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { GIG_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, type GigCategory } from "@/lib/gigs";

interface CategoryFilterProps {
  activeCategory: GigCategory | null;
  onCategoryChange: (category: GigCategory | null) => void;
}

export function CategoryFilter({ activeCategory, onCategoryChange }: CategoryFilterProps) {
  const selectValue = activeCategory ?? "all";

  return (
    <>
      {/* Mobile: compact select dropdown */}
      <div className="sm:hidden px-4 py-2">
        <Select
          value={selectValue}
          onValueChange={(v) => onCategoryChange(v === "all" ? null : (v as GigCategory))}
        >
          <SelectTrigger size="sm" className="w-full">
            {activeCategory ? (
              <>
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[activeCategory] }}
                />
                {CATEGORY_LABELS[activeCategory]}
              </>
            ) : (
              "All Categories"
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {GIG_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                />
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tablet+: scrollable badges */}
      <div className="hidden sm:flex gap-1.5 overflow-x-auto px-4 py-2 scrollbar-none">
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
    </>
  );
}
