"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getFlairsForUsers } from "@/actions/flairs";

/**
 * Batch-fetches flairs for a list of usernames and seeds each individual
 * ["user-flairs", username] cache entry. Returns `isPending` so callers can
 * coordinate loading states — individual <UserFlairs> queries will find
 * pre-populated data and skip their own fetch.
 */
export function usePrefetchUserFlairs(
  usernames: (string | null | undefined)[],
) {
  const queryClient = useQueryClient();

  const filtered = usernames.filter(Boolean) as string[];
  const uncached = filtered.filter(
    (u) => !queryClient.getQueryData(["user-flairs", u]),
  );
  const key = [...uncached].sort().join(",");

  const { isPending } = useQuery({
    queryKey: ["user-flairs-batch", key],
    queryFn: async () => {
      const res = await getFlairsForUsers(uncached);
      if (!res.success) return null;
      for (const [username, flairs] of Object.entries(res.data)) {
        queryClient.setQueryData(["user-flairs", username], flairs);
      }
      // Seed empty arrays for usernames that had no flairs returned
      for (const u of uncached) {
        if (!res.data[u]) {
          queryClient.setQueryData(["user-flairs", u], []);
        }
      }
      return res.data;
    },
    enabled: uncached.length > 0,
    staleTime: 60_000,
  });

  return { isPending: uncached.length > 0 && isPending };
}
