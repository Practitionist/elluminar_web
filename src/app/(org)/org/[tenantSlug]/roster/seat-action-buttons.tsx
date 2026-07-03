"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { revokeSeat, transferSeat } from "@/actions/roster";
import { Button } from "@/components/ui/button";

export function SeatActionButtons({
  tenantSlug,
  seatId,
}: {
  tenantSlug: string;
  seatId: string;
}) {
  const revoke = useAction(revokeSeat, {
    onSuccess: () => toast.success("Seat revoked — licensed access expired."),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  const transfer = useAction(transferSeat, {
    onSuccess: () => toast.success("Seat transferred — invitation sent."),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={transfer.isPending}
        onClick={() => {
          const newEmail = window.prompt("Transfer this seat to (email):");
          if (newEmail) transfer.execute({ tenantSlug, seatId, newEmail });
        }}
      >
        Transfer
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={revoke.isPending}
        onClick={() => {
          if (window.confirm("Revoke this seat? Licensed access ends immediately."))
            revoke.execute({ tenantSlug, seatId });
        }}
      >
        Revoke
      </Button>
    </div>
  );
}
