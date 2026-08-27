"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { surface: "account" } });
  }, [error]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive-subtle">
        <AlertTriangle className="size-6 text-destructive-subtle-foreground" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-medium tracking-tight">
        Couldn&apos;t load this page
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Nothing about your account was changed. Try again, and if it keeps
        happening your session may have expired.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="lg" className="rounded-full" onClick={reset}>
          Try again
        </Button>
        <Button
          render={<Link href="/sign-in" />}
          variant="outline"
          size="lg"
          className="rounded-full"
        >
          Sign in again
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Reference: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
