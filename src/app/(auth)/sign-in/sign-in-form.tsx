"use client";

import { Building2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  AuthHeader,
  FormAlert,
  GoogleIcon,
  OrDivider,
  PasswordField,
  SubmitButton,
  TextField,
} from "@/components/auth";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { authClient } from "@/lib/auth/client";
import { signInSchema, ssoEmailSchema } from "@/lib/validation/auth";

type Mode = "password" | "sso";

/** BetterAuth error codes we can say something more useful about than its default. */
function messageForSignInError(error: {
  status?: number;
  code?: string;
  message?: string;
}): { text: string; needsVerification: boolean } {
  if (error.status === 403) {
    return {
      text: "Verify your email before signing in — we've sent you a fresh link.",
      needsVerification: true,
    };
  }
  if (error.status === 429) {
    return {
      text: "Too many attempts. Wait a minute and try again.",
      needsVerification: false,
    };
  }
  if (error.status === 401) {
    // Deliberately does not distinguish unknown-email from wrong-password.
    return {
      text: "That email and password don't match an account.",
      needsVerification: false,
    };
  }
  return { text: error.message ?? "Sign in failed. Try again.", needsVerification: false };
}

export function SignInForm({
  next,
  initialError,
  googleEnabled,
}: {
  next: string;
  initialError?: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [pending, setPending] = useState<null | "password" | "google" | "sso">(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | undefined>(
    initialError ? "We couldn't complete that sign-in. Try again." : undefined,
  );
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  async function onPasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });

    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
        ),
      );
      return;
    }

    setErrors({});
    setFormMessage(undefined);
    setUnverifiedEmail(null);
    setPending("password");

    const { error } = await authClient.signIn.email({
      email: parsed.data.email,
      password: parsed.data.password,
      rememberMe: parsed.data.rememberMe,
      callbackURL: next,
    });
    setPending(null);

    if (error) {
      const { text, needsVerification } = messageForSignInError(error);
      setFormMessage(text);
      if (needsVerification) setUnverifiedEmail(parsed.data.email);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function onGoogle() {
    setPending("google");
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
    });
    // On success the browser has already navigated to Google, so only the
    // failure path ever reaches here.
    setPending(null);
    if (error) toast.error(error.message ?? "Google sign-in failed");
  }

  async function onSsoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = ssoEmailSchema.safeParse({
      email: new FormData(e.currentTarget).get("ssoEmail"),
    });
    if (!parsed.success) {
      setErrors({ ssoEmail: parsed.error.issues[0]?.message ?? "Enter a valid email" });
      return;
    }

    setErrors({});
    setFormMessage(undefined);
    setPending("sso");
    const { error } = await authClient.signIn.sso({
      email: parsed.data.email,
      callbackURL: next,
    });
    setPending(null);

    if (error) {
      setFormMessage(
        "No verified identity provider is configured for that email domain. Ask your IT team, or sign in with a password.",
      );
    }
  }

  async function onResendVerification() {
    if (!unverifiedEmail) return;
    const { error } = await authClient.sendVerificationEmail({
      email: unverifiedEmail,
      callbackURL: next,
    });
    if (error) toast.error(error.message ?? "Could not resend");
    else toast.success("Verification email sent.");
  }

  return (
    <FadeIn direction="up" duration={0.4}>
      <div className="space-y-6">
        <AuthHeader
          title="Welcome back"
          description="Sign in to pick up where you left off."
        />

        {formMessage ? (
          <FormAlert>
            {formMessage}
            {unverifiedEmail ? (
              <button
                type="button"
                onClick={onResendVerification}
                className="mt-1 block font-semibold underline underline-offset-2"
              >
                Resend the verification email
              </button>
            ) : null}
          </FormAlert>
        ) : null}

        {mode === "password" ? (
          <form onSubmit={onPasswordSubmit} className="space-y-4" noValidate>
            <TextField
              name="email"
              label="Email"
              error={errors.email}
              icon={<Mail className="size-4" />}
              inputProps={{
                type: "email",
                autoComplete: "email",
                autoFocus: true,
                placeholder: "you@example.com",
              }}
            />
            <PasswordField
              name="password"
              label="Password"
              error={errors.password}
              autoComplete="current-password"
            >
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </PasswordField>
            <SubmitButton pending={pending === "password"} pendingLabel="Signing in…">
              Sign in
            </SubmitButton>
          </form>
        ) : (
          <form onSubmit={onSsoSubmit} className="space-y-4" noValidate>
            <TextField
              name="ssoEmail"
              label="Work email"
              error={errors.ssoEmail}
              icon={<Building2 className="size-4" />}
              description="We'll route you to your organization's identity provider."
              inputProps={{
                type: "email",
                autoComplete: "email",
                autoFocus: true,
                placeholder: "you@company.com",
              }}
            />
            <SubmitButton pending={pending === "sso"} pendingLabel="Redirecting…">
              Continue with SSO
            </SubmitButton>
          </form>
        )}

        <OrDivider />

        <div className="space-y-3">
          {googleEnabled ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full rounded-full"
              disabled={pending === "google"}
              onClick={onGoogle}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full rounded-full"
            onClick={() => {
              setErrors({});
              setFormMessage(undefined);
              setMode(mode === "password" ? "sso" : "password");
            }}
          >
            {mode === "password" ? (
              <>
                <Building2 className="size-4" />
                Sign in with SSO
              </>
            ) : (
              <>
                <Mail className="size-4" />
                Sign in with a password
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/sign-up" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </FadeIn>
  );
}
