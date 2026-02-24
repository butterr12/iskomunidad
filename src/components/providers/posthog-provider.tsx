"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      ui_host: "https://us.posthog.com",
      capture_pageview: false, // manual SPA tracking via PageviewTracker
      capture_pageleave: true, // needed for $session_duration
      autocapture: true,
      persistence: "localStorage+cookie",
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

// Must be wrapped in <Suspense> by parent due to useSearchParams
export function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    const url =
      pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    ph?.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}
