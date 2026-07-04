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
  "/org",
  "/account",
  "/billing",
  "/onboarding",
];

export default function proxy(request: NextRequest) {
  // DEV-ONLY: when DEV_DISABLE_AUTH=true (and not production), skip the auth
  // gate so the whole UI is browsable without signing in. Never active in prod.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_DISABLE_AUTH === "true"
  ) {
    return NextResponse.next();
  }

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
    "/org/:path*",
    "/org",
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
