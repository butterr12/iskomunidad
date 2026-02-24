"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, X, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { searchMentionableUsers, followUser, unfollowUser, type MentionCandidate } from "@/actions/follows";

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

export function PeopleTab() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [followOverrides, setFollowOverrides] = useState<Record<string, boolean>>({});

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["people-search", debouncedQuery],
    queryFn: async () => {
      const res = await searchMentionableUsers(debouncedQuery);
      return res.success ? res.data : [];
    },
    staleTime: 30_000,
  });

  const getFollowStatus = (u: MentionCandidate) =>
    u.id in followOverrides ? followOverrides[u.id] : u.isFollowing;

  const handleFollowToggle = async (e: React.MouseEvent, u: MentionCandidate) => {
    e.stopPropagation();
    const current = getFollowStatus(u);
    setFollowOverrides((prev) => ({ ...prev, [u.id]: !current }));
    const res = current ? await unfollowUser(u.id) : await followUser(u.id);
    if (!res.success) {
      // Revert on failure
      setFollowOverrides((prev) => ({ ...prev, [u.id]: current }));
    }
  };

  const showSkeleton = isLoading;
  const showEmpty = !isLoading && results.length === 0;
  const showResults = !isLoading && results.length > 0;
  const sectionLabel = debouncedQuery ? "Results" : "Suggested";

  return (
    <div className="flex flex-1 flex-col min-h-0 pt-12 pb-safe-nav sm:pt-14 sm:pb-0">
      {/* Sub-header */}
      <div className="sticky top-12 sm:top-14 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-2">
          <h2 className="text-lg font-semibold">People</h2>
        </div>
        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or @username…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg px-4 py-3">
          {/* Loading skeletons */}
          {showSkeleton && (
            <div className="space-y-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex flex-col gap-1.5 flex-1">
                    <Skeleton className="h-3.5 w-28 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <UserRound className="h-9 w-9 text-muted-foreground/40" />
              <p className="text-sm font-medium">
                {debouncedQuery ? "No users found" : "No suggestions yet"}
              </p>
              <p className="text-xs">
                {debouncedQuery
                  ? "Try a different name or username"
                  : "Follow people to see suggestions here"}
              </p>
            </div>
          )}

          {/* Results */}
          {showResults && (
            <>
              <p className="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {sectionLabel}
              </p>
              <div className="space-y-0.5">
                {results.map((u) => {
                  const isFollowing = getFollowStatus(u);
                  return (
                    <div
                      key={u.id}
                      onClick={() => router.push(`/profile/${u.username}`)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted active:bg-muted/70 cursor-pointer"
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={u.image ?? undefined} alt={u.name} />
                        <AvatarFallback>{getInitials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={isFollowing ? "outline" : "default"}
                        className="shrink-0"
                        onClick={(e) => handleFollowToggle(e, u)}
                      >
                        {isFollowing ? "Following" : "Follow"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
