"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  X,
  ArrowLeft,
  Users2,
  MessageSquare,
  CalendarDays,
  Hammer,
  ChevronRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { globalSearch, type GroupedSearchResults } from "@/actions/search";
import { FLAIR_COLORS, type PostFlair } from "@/lib/posts";
import { EVENT_CATEGORY_LABELS } from "@/lib/events";
import { CATEGORY_LABELS, type GigCategory } from "@/lib/gigs";
import { format } from "date-fns";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ResultSkeleton() {
  return (
    <div className="space-y-6 px-4 py-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-20 rounded" />
          <div className="space-y-1.5">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3 rounded" />
                  <Skeleton className="h-3 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SearchView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: async () => {
      const res = await globalSearch(debouncedQuery);
      return res.success ? res.data : null;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const isEmpty =
    data &&
    data.people.length === 0 &&
    data.posts.length === 0 &&
    data.events.length === 0 &&
    data.gigs.length === 0;

  const hasResults = data && !isEmpty;
  const showSkeleton = isLoading && debouncedQuery.length >= 2;

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      {/* Sticky search header */}
      <div className="sticky top-12 sm:top-14 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            onClick={() => router.back()}
            className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-muted px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, posts, events, gigs…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg">
          {/* Idle state */}
          {!debouncedQuery && (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
              <Search className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm">Search across iskomunidad</p>
            </div>
          )}

          {/* Too short */}
          {debouncedQuery.length === 1 && (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
              <p className="text-sm">Type at least 2 characters</p>
            </div>
          )}

          {/* Loading */}
          {showSkeleton && <ResultSkeleton />}

          {/* Empty */}
          {isEmpty && !isFetching && (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
              <Search className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium">
                No results for &ldquo;{debouncedQuery}&rdquo;
              </p>
              <p className="text-xs">Try a different search term</p>
            </div>
          )}

          {/* Results */}
          {hasResults && (
            <div className="flex flex-col gap-5 px-4 py-4">
              {/* People */}
              {data.people.length > 0 && (
                <ResultSection
                  icon={<Users2 className="h-3.5 w-3.5" />}
                  label="People"
                >
                  {data.people.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => router.push(`/profile/${p.username}`)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted active:bg-muted/70 text-left"
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={p.image ?? undefined} alt={p.name} />
                        <AvatarFallback className="text-xs">
                          {getInitials(p.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          @{p.username}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </ResultSection>
              )}

              {/* Posts */}
              {data.posts.length > 0 && (
                <ResultSection
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                  label="Posts"
                >
                  {data.posts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => router.push(`/c/${p.id}`)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted active:bg-muted/70 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{p.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                            style={{
                              borderColor:
                                FLAIR_COLORS[p.flair as PostFlair] ?? undefined,
                              color:
                                FLAIR_COLORS[p.flair as PostFlair] ?? undefined,
                            }}
                          >
                            {p.flair}
                          </Badge>
                          <span className="text-xs text-muted-foreground truncate">
                            {p.authorHandle ? `@${p.authorHandle}` : p.authorName}
                          </span>
                          {p.commentCount > 0 && (
                            <span className="text-xs text-muted-foreground">
                              · {p.commentCount} {p.commentCount === 1 ? "comment" : "comments"}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </ResultSection>
              )}

              {/* Events */}
              {data.events.length > 0 && (
                <ResultSection
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                  label="Events"
                >
                  {data.events.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => router.push(`/events?event=${e.id}`)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted active:bg-muted/70 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{e.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {EVENT_CATEGORY_LABELS[e.category as keyof typeof EVENT_CATEGORY_LABELS] ?? e.category}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            · {format(new Date(e.startDate), "MMM d")}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            · {e.organizer}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </ResultSection>
              )}

              {/* Gigs */}
              {data.gigs.length > 0 && (
                <ResultSection
                  icon={<Hammer className="h-3.5 w-3.5" />}
                  label="Gigs"
                >
                  {data.gigs.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => router.push(`/gigs?gig=${g.id}`)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted active:bg-muted/70 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{g.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {CATEGORY_LABELS[g.category as GigCategory] ?? g.category}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            · {g.compensation}
                          </span>
                          {!g.isOpen && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Closed
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </ResultSection>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultSection({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
