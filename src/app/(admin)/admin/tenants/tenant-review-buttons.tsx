"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { reviewTenant } from "@/actions/tenant";
import { Button } from "@/components/ui/button";

export function TenantReviewButtons({ tenantId }: { tenantId: string }) {
  const { execute, isPending } = useAction(reviewTenant, {
    onSuccess: () => toast.success("Decision recorded"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() => execute({ tenantId, decision: "APPROVED" })}
      >
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => execute({ tenantId, decision: "SUSPENDED" })}
      >
        Suspend
      </Button>
    </div>
  );
}
