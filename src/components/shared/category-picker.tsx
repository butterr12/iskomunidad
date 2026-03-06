"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlaceCategories } from "@/actions/landmarks";
import type { PlaceCategory } from "@/lib/landmarks";
import { DynamicIcon } from "@/components/shared/dynamic-icon";

interface CategoryPickerProps {
  value: string | null;
  onChange: (categoryId: string) => void;
}

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const [search, setSearch] = useState("");

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["place-categories"],
    queryFn: async () => {
      const res = await getPlaceCategories();
      return res.success ? (res.data as PlaceCategory[]) : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const filtered = search
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      )
    : categories;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.map((cat) => {
          const selected = value === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onChange(cat.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors",
                selected
                  ? "border-2 bg-opacity-10"
                  : "border-muted hover:border-muted-foreground/30",
              )}
              style={
                selected
                  ? {
                      borderColor: cat.color,
                      backgroundColor: `${cat.color}15`,
                    }
                  : undefined
              }
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
              >
                <DynamicIcon name={cat.icon} size={16} />
              </div>
              <span className="text-sm font-medium leading-tight">
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No categories found
        </p>
      )}
    </div>
  );
}
