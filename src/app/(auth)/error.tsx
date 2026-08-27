"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { AuthHeader } from "@/components/auth";
import { Button } from "@/components/ui/button";

/**
 * The `(auth)` group had no error boundary, so anything thrown while rendering
 * a sign-in page fell through to `global-error.tsx` — which replaces the entire
 * document, chrome and all. Here the shell survives and the user keeps a route
 * out.
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { surface: "auth" } });
  }, [error]);

  return (
    <div className="space-y-6">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive-subtle">
        <AlertTriangle className="size-6 text-destructive-subtle-foreground" />
      </div>
      <AuthHeader
        title="Something went wrong"
        description="We hit an error loading this page. Your account is fine — nothing was changed."
      />
      <div className="flex flex-col gap-2">
        <Button size="lg" className="w-full rounded-full" onClick={reset}>
          Try again
        </Button>
        <Button
          render={<Link href="/sign-in" />}
          variant="outline"
          size="lg"
          className="w-full rounded-full"
        >
          Back to sign in
        </Button>
      </div>
      {error.digest ? (
        <p className="text-center text-xs text-muted-foreground">
          Reference: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
