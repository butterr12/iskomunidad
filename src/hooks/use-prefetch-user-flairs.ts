"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getFlairsForUsers } from "@/actions/flairs";

/**
 * Batch-fetches flairs for a list of usernames and seeds each individual
 * ["user-flairs", username] cache entry. Returns `isPending` so callers can
 * gate rendering — individual <UserFlairs> components will mount with data
 * already in cache and skip their own fetch.
 */
export function usePrefetchUserFlairs(
  usernames: (string | null | undefined)[],
) {
  const queryClient = useQueryClient();

  const filtered = [...new Set(usernames.filter(Boolean) as string[])];
  // Use the full filtered list for a stable key (uncached subset changes
  // after the batch seeds the cache, which would orphan the in-flight query).
  const key = [...filtered].sort().join(",");

  const hasUncached = filtered.some(
    (u) => !queryClient.getQueryData(["user-flairs", u]),
  );

  const { isPending } = useQuery({
    queryKey: ["user-flairs-batch", key],
    queryFn: async () => {
      const toFetch = filtered.filter(
        (u) => !queryClient.getQueryData(["user-flairs", u]),
      );
      if (toFetch.length === 0) return {};
      const res = await getFlairsForUsers(toFetch);
      if (!res.success) return null;
      for (const [username, flairs] of Object.entries(res.data)) {
        queryClient.setQueryData(["user-flairs", username], flairs);
      }
      // Seed empty arrays for usernames with no flairs
      for (const u of toFetch) {
        if (!res.data[u]) {
          queryClient.setQueryData(["user-flairs", u], []);
        }
      }
      return res.data;
    },
    enabled: filtered.length > 0 && hasUncached,
    staleTime: 60_000,
  });

  return { isPending: hasUncached && isPending };
}
