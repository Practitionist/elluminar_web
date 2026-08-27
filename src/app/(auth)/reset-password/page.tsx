import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { AuthHeader, FormAlert } from "@/components/auth";
import { Button } from "@/components/ui/button";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Choose a new password" };

/**
 * BetterAuth redirects here with either `?token=…` or `?error=INVALID_TOKEN`.
 * Both are read server-side, so an expired link renders as a real page rather
 * than a form that only reveals the problem after the user has typed a new
 * password twice and pressed submit.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (error || !token) {
    return (
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive-subtle">
          <AlertTriangle className="size-6 text-destructive-subtle-foreground" />
        </div>
        <AuthHeader
          title="This link has expired"
          description="Reset links are single-use and last one hour. Request a fresh one and we'll email it straight away."
        />
        <FormAlert tone="info">
          Your password has not changed. The old one still works.
        </FormAlert>
        <div className="flex flex-col gap-2">
          <Button
            render={<Link href="/forgot-password" />}
            size="lg"
            className="w-full rounded-full"
          >
            Send a new link
          </Button>
          <Button
            render={<Link href="/sign-in" />}
            variant="ghost"
            size="lg"
            className="w-full rounded-full"
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
