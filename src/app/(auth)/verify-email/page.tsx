import { getSession } from "@/lib/auth/session";

import { VerifyEmailForm } from "./verify-email-form";

export const metadata = { title: "Verify your email" };

/**
 * The old version asked the user to retype the address they had just signed up
 * with. We already know it in two places — the pending session (BetterAuth
 * creates one even when `requireEmailVerification` blocks the sign-in) and the
 * `?email=` the sign-up redirect carries — so ask for nothing.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const [{ email }, session] = await Promise.all([searchParams, getSession()]);

  return (
    <VerifyEmailForm
      knownEmail={session?.user.email ?? email ?? null}
      alreadyVerified={Boolean(session?.user.emailVerified)}
    />
  );
}
