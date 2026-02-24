"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Hash, TrendingUp } from "lucide-react";
import { getPopularTags } from "@/actions/tags";
import { Skeleton } from "@/components/ui/skeleton";

interface PopularTagsPanelProps {
  limit?: number;
  onTagClick?: (tag: string) => void;
}

export function PopularTagsPanel({ limit = 15, onTagClick }: PopularTagsPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["popular-tags", limit],
    queryFn: async () => {
      const res = await getPopularTags(limit);
      return res.success ? res.data : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!data?.length) return null;

  return (
    <>
      {data.map(({ tag, count }) =>
        onTagClick ? (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
          >
            <span className="flex items-center gap-1 font-medium">
              <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {tag}
            </span>
            <span className="text-xs text-muted-foreground">{count}</span>
          </button>
        ) : (
          <Link
            key={tag}
            href={`/t/${encodeURIComponent(tag)}`}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <span className="flex items-center gap-1 font-medium">
              <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {tag}
            </span>
            <span className="text-xs text-muted-foreground">{count}</span>
          </Link>
        )
      )}
    </>
  );
}

export function PopularTagsPanelHeader() {
  return (
    <div className="flex items-center gap-1.5 border-b px-4 py-3">
      <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
      <h3 className="text-sm font-semibold">Trending Tags</h3>
    </div>
  );
}
