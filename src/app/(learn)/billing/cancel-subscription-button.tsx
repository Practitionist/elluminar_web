"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { cancelMySubscription } from "@/actions/subscribe";
import { Button } from "@/components/ui/button";

export function CancelSubscriptionButton({ subscriptionId }: { subscriptionId: string }) {
  const { execute, isPending } = useAction(cancelMySubscription, {
    onSuccess: () =>
      toast.success("Cancellation scheduled — access continues until the period ends."),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full"
      disabled={isPending}
      onClick={() => {
        if (
          window.confirm(
            "Cancel your membership? You keep access until the end of the paid period; à la carte purchases are unaffected.",
          )
        ) {
          execute({ subscriptionId });
        }
      }}
    >
      {isPending ? "Cancelling…" : "Cancel membership"}
    </Button>
  );
}
