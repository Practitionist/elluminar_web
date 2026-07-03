"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { decideRefund } from "@/actions/refunds";
import { Button } from "@/components/ui/button";

export function RefundDecisionButtons({ refundId }: { refundId: string }) {
  const { execute, isPending } = useAction(decideRefund, {
    onSuccess: () => toast.success("Decision recorded"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() => execute({ refundId, decision: "APPROVED" })}
      >
        {isPending ? "Processing…" : "Approve & process"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => execute({ refundId, decision: "REJECTED" })}
      >
        Reject
      </Button>
    </div>
  );
}
