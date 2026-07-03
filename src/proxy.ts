import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate: checks only for the presence of the session cookie
 * (fast, no DB). Real authorization happens in server components/actions via
 * src/lib/auth/session.ts helpers.
 */
const PROTECTED_PREFIXES = [
  "/learn",
  "/studio",
  "/mentor",
  "/admin",
  "/account",
  "/billing",
  "/onboarding",
];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!needsAuth) return NextResponse.next();

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/learn/:path*",
    "/studio/:path*",
    "/mentor/:path*",
    "/admin/:path*",
    "/account/:path*",
    "/billing/:path*",
    "/onboarding/:path*",
    "/learn",
    "/studio",
    "/mentor",
    "/admin",
    "/account",
    "/billing",
    "/onboarding",
  ],
};
