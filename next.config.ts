import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.storage.railway.app" },
      { protocol: "https", hostname: "*.storageapi.dev" },
      { protocol: "https", hostname: "maps.googleapis.com" },
      { protocol: "https", hostname: "places.googleapis.com" },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: "bscale-ventures",
  project: "iskomunidad",
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print upload logs in CI
  silent: !process.env.CI,

  // Route Sentry requests through your server to avoid ad-blockers
  tunnelRoute: "/monitoring",
});
