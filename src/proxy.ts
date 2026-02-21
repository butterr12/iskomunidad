import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { randomUUID } from "node:crypto";
import {
  REFERRAL_QUERY_PARAM,
  REFERRAL_COOKIE_NAME,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  normalizeRef,
} from "@/lib/referrals";

const publicPrefixes = [
  "/sign-in",
  "/sign-up",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
];

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Legacy community URLs -> canonical /c routes.
  if (pathname === "/community" || pathname.startsWith("/community/")) {
    const destination = request.nextUrl.clone();
    const postId = searchParams.get("post");
    if (pathname === "/community" && postId) {
      destination.pathname = `/c/${postId}`;
      destination.search = "";
    } else {
      destination.pathname =
        pathname === "/community"
          ? "/c"
          : pathname.replace(/^\/community/, "/c");
      destination.search = request.nextUrl.search;
    }
    return NextResponse.redirect(destination, 308);
  }

  const isPublicRoute =
    pathname === "/" ||
    publicPrefixes.some((route) => pathname.startsWith(route)) ||
    /^\/c\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(pathname);
  const isApiRoute = pathname.startsWith("/api");

  const sessionCookie = getSessionCookie(request);
  const isAuthenticated = !!sessionCookie;

  // Determine response
  let response: NextResponse;
  if (isPublicRoute || isApiRoute) {
    response = NextResponse.next();
  } else if (!isAuthenticated) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname + request.nextUrl.search);
    response = NextResponse.redirect(signInUrl);
  } else {
    response = NextResponse.next();
  }

  // Set referral cookie if applicable (first-touch, unauthenticated only)
  const ref = request.nextUrl.searchParams.get(REFERRAL_QUERY_PARAM);
  const hasRefCookie = request.cookies.has(REFERRAL_COOKIE_NAME);

  if (ref && !hasRefCookie && !isAuthenticated) {
    const normalized = normalizeRef(ref);
    if (normalized) {
      response.cookies.set(REFERRAL_COOKIE_NAME, normalized, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
      });
    }
  }

  // Set device fingerprint cookie for abuse detection
  if (!request.cookies.has("ik_did")) {
    response.cookies.set("ik_did", randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
