import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { checkRateLimit, getIpFromHeaders } from "@/lib/rate-limit";
import { guard } from "@/lib/abuse/guard";
import { resolveIdentityFromRaw } from "@/lib/abuse/identity";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: Request) {
  const url = new URL(request.url);

  // Block all direct signup endpoints — signup must go through server actions
  // that record legal consent first.
  if (url.pathname.includes("/sign-up/")) {
    return Response.json(
      { error: "Direct signup not allowed" },
      { status: 403 },
    );
  }

  // Rate limit auth endpoints (login, magic link, password reset)
  const ip = getIpFromHeaders(request.headers);
  const result = checkRateLimit("auth", ip);
  if (!result.allowed) {
    const retryAfter = Math.ceil(result.retryAfterMs / 1000);
    return Response.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  // Abuse guard (alongside existing rate limit as fallback)
  const deviceId = request.headers.get("cookie")?.match(/ik_did=([^;]+)/)?.[1];
  const identity = resolveIdentityFromRaw({ ip, deviceId });
  const abuseResult = await guard("auth.login", identity);
  if (abuseResult.decision === "deny" || abuseResult.decision === "throttle") {
    return Response.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  return handler.POST(request);
}
