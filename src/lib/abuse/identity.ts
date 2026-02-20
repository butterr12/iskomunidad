import { createHmac } from "node:crypto";
import type { AbuseIdentity } from "./types";

const DEVICE_COOKIE_NAME = "ik_did";

function getSecret(): string {
  return process.env.ABUSE_HASH_SECRET ?? "dev-abuse-secret-change-me";
}

function hmacHash(value: string): string {
  return createHmac("sha256", getSecret())
    .update(value)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Resolve identity from server actions (reads next/headers and next/cookies).
 */
export async function resolveIdentity(
  userId?: string,
  opts?: { email?: string },
): Promise<AbuseIdentity> {
  const { headers, cookies } = await import("next/headers");
  const hdrs = await headers();
  const cookieStore = await cookies();

  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    hdrs.get("cf-connecting-ip") ??
    "unknown";

  const deviceId = cookieStore.get(DEVICE_COOKIE_NAME)?.value;

  return {
    userId: userId ? hmacHash(userId) : undefined,
    ipHash: hmacHash(ip),
    deviceHash: deviceId ? hmacHash(deviceId) : undefined,
    emailHash: opts?.email ? hmacHash(opts.email.toLowerCase().trim()) : undefined,
  };
}

/**
 * Resolve identity from raw values (for API routes and socket context).
 */
export function resolveIdentityFromRaw(raw: {
  userId?: string;
  ip?: string;
  deviceId?: string;
  email?: string;
}): AbuseIdentity {
  return {
    userId: raw.userId ? hmacHash(raw.userId) : undefined,
    ipHash: raw.ip ? hmacHash(raw.ip) : undefined,
    deviceHash: raw.deviceId ? hmacHash(raw.deviceId) : undefined,
    emailHash: raw.email ? hmacHash(raw.email.toLowerCase().trim()) : undefined,
  };
}
