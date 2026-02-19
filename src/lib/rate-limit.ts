/**
 * In-memory fixed-window rate limiter.
 *
 * Perfect for single-server deployments — zero dependencies, O(1) lookups.
 * If you scale to multiple instances, swap the `store` Map for Redis.
 */

// ─── Tier definitions ────────────────────────────────────────────────────────

const TIERS = {
  /** Signup, login, magic link, password reset — strict but allows a few retries */
  auth: { windowMs: 15 * 60 * 1000, max: 20 },
  /** Posts, comments, events, gigs, messages */
  create: { windowMs: 60 * 1000, max: 20 },
  /** File uploads */
  upload: { windowMs: 60 * 1000, max: 10 },
  /** Public proxies (Google Places photos, S3 presigned URLs) */
  proxy: { windowMs: 60 * 1000, max: 30 },
  /** General authenticated actions */
  general: { windowMs: 60 * 1000, max: 60 },
} as const;

export type RateLimitTier = keyof typeof TIERS;

// ─── Store ───────────────────────────────────────────────────────────────────

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Sweep expired entries every 60 s to prevent unbounded growth.
// `.unref()` ensures this timer won't keep the process alive on shutdown.
const SWEEP_INTERVAL_MS = 60_000;
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}, SWEEP_INTERVAL_MS);
sweepTimer.unref();

// ─── Core check ──────────────────────────────────────────────────────────────

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterMs: number };

export function checkRateLimit(
  tier: RateLimitTier,
  identifier: string,
): RateLimitResult {
  const { windowMs, max } = TIERS[tier];
  const key = `${tier}:${identifier}`;
  const now = Date.now();

  const entry = store.get(key);

  // New window or expired window — start fresh
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }

  // Within window and under limit
  if (entry.count < max) {
    entry.count++;
    return { allowed: true, remaining: max - entry.count };
  }

  // Over limit
  return { allowed: false, retryAfterMs: entry.resetAt - now };
}

// ─── Helpers for API routes ──────────────────────────────────────────────────

/**
 * Extract the client IP from standard proxy headers.
 * Works with NextRequest, plain Request, or a Headers object.
 */
export function getIpFromHeaders(h: Headers): string {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown"
  );
}
