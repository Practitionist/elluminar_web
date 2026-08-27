"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { completeOnboarding } from "@/actions/onboarding";

/**
 * Skipping stamps `onboardedAt` exactly like finishing does. Leaving it null
 * would mean re-asking on every single visit, which turns a one-time nicety
 * into a permanent obstacle — and every question here is also under /account.
 */
export function SkipLink() {
  const router = useRouter();

  const { execute, isPending } = useAction(completeOnboarding, {
    onSuccess: () => {
      router.push("/learn");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Could not skip"),
  });

  return (
    <p className="text-center text-sm text-muted-foreground">
      <button
        type="button"
        disabled={isPending}
        onClick={() => execute({ skipped: true })}
        className="font-medium hover:text-primary hover:underline disabled:opacity-50"
      >
        {isPending ? "Skipping…" : "Skip for now"}
      </button>{" "}
      — you can fill this in later under Account.
    </p>
  );
}
