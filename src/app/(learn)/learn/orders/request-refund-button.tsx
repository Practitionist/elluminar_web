"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { requestRefund } from "@/actions/refunds";
import { Button } from "@/components/ui/button";

export function RequestRefundButton({ orderItemId }: { orderItemId: string }) {
  const { execute, isPending } = useAction(requestRefund, {
    onSuccess: () => toast.success("Refund requested — we'll process it shortly."),
    onError: ({ error }) => toast.error(error.serverError ?? "Request failed"),
  });

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full"
      disabled={isPending}
      onClick={() => {
        if (window.confirm("Request a refund for this item? Access will be revoked once processed.")) {
          execute({ orderItemId });
        }
      }}
    >
      {isPending ? "Requesting…" : "Request refund"}
    </Button>
  );
}
