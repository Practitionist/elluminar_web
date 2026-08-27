import { env } from "@/env";

import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

/**
 * Server shell. Reading `searchParams` here rather than with `useSearchParams`
 * removes the `<Suspense>` boundary the client version needed — that boundary
 * had no fallback, so the whole form flashed blank on first paint.
 *
 * It also lets us tell the client whether Google is actually configured.
 * `socialProviders` is spread conditionally in lib/auth, so with no
 * GOOGLE_CLIENT_ID the button used to render and then fail on click.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <SignInForm
      next={sanitizeNext(next)}
      initialError={error}
      googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}
    />
  );
}

/**
 * `next` is attacker-controlled (the proxy puts it there, but so can anyone).
 * Only same-origin absolute paths are allowed, so it can't be used as an open
 * redirect into a phishing page that looks like a continuation of sign-in.
 */
function sanitizeNext(next: string | undefined): string {
  if (!next) return "/learn";
  // Reject scheme-relative ("//evil.com") and absolute URLs alike.
  if (!next.startsWith("/") || next.startsWith("//")) return "/learn";
  return next;
}
