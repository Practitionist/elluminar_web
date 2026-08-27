"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/client";

/**
 * Signed-in vs signed-out header affordance, resolved in the BROWSER.
 *
 * Why this is a client component and not a server `getSession()` call
 * ------------------------------------------------------------------
 * `getSession()` reads `headers()`, and a request-scoped read anywhere in a
 * route's server render tree pins that route to dynamic rendering. Doing it in
 * the marketing *layout* pinned the entire `(marketing)` segment — every public
 * page, including `/` which reads no data at all. Next then emits
 * `cache-control: private, no-cache, no-store`, so nothing is cacheable at the
 * CDN and every navigation invokes the serverless function. Measured cost of
 * that on Netlify: a cold instance answered `/` in 10.4–11.1 s.
 *
 * The chrome is the *only* thing that differed for signed-in visitors, so the
 * session read belongs here — in the browser — and the pages go back to being
 * static HTML served from the edge with no function invocation at all.
 *
 * The pending branch renders a fixed-width spacer rather than the signed-out
 * buttons, so a signed-in visitor never sees "Sign in" flash before
 * "Dashboard", and the header does not shift width when the session resolves.
 */
export function HeaderAuth() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    // Reserves the signed-out pair's footprint; `aria-hidden` keeps a
    // transient placeholder out of the accessibility tree.
    return <div aria-hidden className="h-8 w-[9.5rem]" />;
  }

  if (session) {
    return (
      <Button
        render={<Link href="/learn" />}
        size="sm"
        className="rounded-full px-4 shadow-md transition-all hover:shadow-lg"
      >
        Dashboard
      </Button>
    );
  }

  return (
    <>
      <Button
        render={<Link href="/sign-in" />}
        variant="ghost"
        size="sm"
        className="rounded-full"
      >
        Sign in
      </Button>
      <Button
        render={<Link href="/sign-up" />}
        size="sm"
        className="rounded-full px-4 shadow-md transition-all hover:shadow-lg"
      >
        Get started
      </Button>
    </>
  );
}
