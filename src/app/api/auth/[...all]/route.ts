import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { checkRateLimit, getIpFromHeaders } from "@/lib/rate-limit";

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

  return handler.POST(request);
}
