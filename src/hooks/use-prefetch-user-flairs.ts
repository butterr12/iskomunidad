"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getFlairsForUsers } from "@/actions/flairs";

export function usePrefetchUserFlairs(
  usernames: (string | null | undefined)[],
) {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);

  const filtered = usernames.filter(Boolean) as string[];
  const key = filtered.sort().join(",");

  useEffect(() => {
    if (!key) return;

    const uncached = filtered.filter(
      (u) => !queryClient.getQueryData(["user-flairs", u]),
    );

    if (uncached.length < 2 || inFlight.current) return;

    inFlight.current = true;
    getFlairsForUsers(uncached)
      .then((res) => {
        if (!res.success) return;
        for (const [username, flairs] of Object.entries(res.data)) {
          queryClient.setQueryData(["user-flairs", username], flairs);
        }
      })
      .finally(() => {
        inFlight.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
