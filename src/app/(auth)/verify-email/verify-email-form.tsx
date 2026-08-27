"use client";

import { CheckCircle2, Mail, MailCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AuthHeader,
  FormAlert,
  SubmitButton,
  TextField,
} from "@/components/auth";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { authClient } from "@/lib/auth/client";
import { emailSchema } from "@/lib/validation/auth";

/** Long enough to stop accidental double-taps, short enough not to trap anyone. */
const RESEND_COOLDOWN_SECONDS = 45;

export function VerifyEmailForm({
  knownEmail,
  alreadyVerified,
}: {
  knownEmail: string | null;
  alreadyVerified: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (alreadyVerified) {
    return (
      <FadeIn direction="up" duration={0.4}>
        <div className="space-y-6">
          <div className="flex size-12 items-center justify-center rounded-full bg-success-subtle">
            <CheckCircle2 className="size-6 text-success-subtle-foreground" />
          </div>
          <AuthHeader
            title="You're all set"
            description="Your email is verified. Nothing else to do here."
          />
          <Button render={<Link href="/learn" />} size="lg" className="w-full rounded-full">
            Go to your dashboard
          </Button>
        </div>
      </FadeIn>
    );
  }

  async function resend(email: string) {
    setError(undefined);
    setPending(true);
    const { error: sendError } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/learn",
    });
    setPending(false);

    if (sendError) {
      setError(
        sendError.status === 429
          ? "That's a few too many. Wait a minute before trying again."
          : (sendError.message ?? "Could not resend the email."),
      );
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    toast.success("Verification email sent.");
  }

  return (
    <FadeIn direction="up" duration={0.4}>
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary-subtle">
          <MailCheck className="size-6 text-primary-subtle-foreground" />
        </div>

        <AuthHeader
          title="Check your inbox"
          description={
            knownEmail ? (
              <>
                We sent a verification link to{" "}
                <span className="font-medium text-foreground">{knownEmail}</span>
                . Click it to activate your account.
              </>
            ) : (
              "We sent you a verification link. Click it to activate your account."
            )
          }
        />

        {error ? <FormAlert>{error}</FormAlert> : null}

        {knownEmail ? (
          <div className="space-y-3">
            <SubmitButton
              type="button"
              pending={pending}
              pendingLabel="Sending…"
              disabled={cooldown > 0}
              onClick={() => resend(knownEmail)}
              variant="outline"
            >
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend the verification email"}
            </SubmitButton>
            <p className="text-center text-xs text-muted-foreground">
              Wrong address?{" "}
              <Link href="/sign-up" className="font-medium text-primary hover:underline">
                Sign up again
              </Link>{" "}
              with the right one.
            </p>
          </div>
        ) : (
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = emailSchema.safeParse(
                new FormData(e.currentTarget).get("email"),
              );
              if (!parsed.success) {
                setError("Enter a valid email address.");
                return;
              }
              void resend(parsed.data);
            }}
          >
            <TextField
              name="email"
              label="Resend to"
              icon={<Mail className="size-4" />}
              inputProps={{
                type: "email",
                autoComplete: "email",
                placeholder: "you@example.com",
              }}
            />
            <SubmitButton
              pending={pending}
              pendingLabel="Sending…"
              disabled={cooldown > 0}
              variant="outline"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
            </SubmitButton>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/sign-in" className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </FadeIn>
  );
}
