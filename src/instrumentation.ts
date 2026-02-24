export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Capture errors thrown in Server Components, middleware, and proxies
import * as Sentry from "@sentry/nextjs";
export const onRequestError = Sentry.captureRequestError;
