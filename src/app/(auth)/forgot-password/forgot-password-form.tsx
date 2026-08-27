"use client";

import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  AuthHeader,
  FormAlert,
  SubmitButton,
  TextField,
} from "@/components/auth";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { authClient } from "@/lib/auth/client";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({
      email: new FormData(e.currentTarget).get("email"),
    });
    if (!parsed.success) {
      setErrors({ email: parsed.error.issues[0]?.message ?? "Enter a valid email" });
      return;
    }

    setErrors({});
    setPending(true);
    await authClient.requestPasswordReset({
      email: parsed.data.email,
      redirectTo: "/reset-password",
    });
    setPending(false);

    // Deliberately unconditional. Reporting "no such account" here would turn
    // this form into an account-enumeration oracle, and the rate limit on
    // /request-password-reset (3 per 5 min) is what stops abuse.
    setSentTo(parsed.data.email);
  }

  if (sentTo) {
    return (
      <FadeIn direction="up" duration={0.4}>
        <div className="space-y-6">
          <div className="flex size-12 items-center justify-center rounded-full bg-success-subtle">
            <MailCheck className="size-6 text-success-subtle-foreground" />
          </div>
          <AuthHeader
            title="Check your inbox"
            description={
              <>
                If an account exists for{" "}
                <span className="font-medium text-foreground">{sentTo}</span>, a
                reset link is on its way. It expires in one hour.
              </>
            }
          />
          <FormAlert tone="info">
            Nothing after a few minutes? Check spam, then try again — the link
            only sends to a registered address.
          </FormAlert>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="lg"
              className="w-full rounded-full"
              onClick={() => setSentTo(null)}
            >
              Use a different email
            </Button>
            <Button
              render={<Link href="/sign-in" />}
              variant="ghost"
              size="lg"
              className="w-full rounded-full"
            >
              <ArrowLeft className="size-4" />
              Back to sign in
            </Button>
          </div>
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn direction="up" duration={0.4}>
      <div className="space-y-6">
        <AuthHeader
          title="Reset your password"
          description="Tell us the email on your account and we'll send you a link."
        />
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
          <SubmitButton pending={pending} pendingLabel="Sending…">
            Send reset link
          </SubmitButton>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/sign-in" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </FadeIn>
  );
}
