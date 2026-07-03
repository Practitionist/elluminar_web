"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { recordPayout } from "@/actions/ops";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RecordPayoutDialog({
  ledgerAccountId,
  ownerName,
  balanceRupees,
}: {
  ledgerAccountId: string;
  ownerName: string;
  balanceRupees: number;
}) {
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(recordPayout, {
    onSuccess: () => {
      toast.success("Payout recorded");
      setOpen(false);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Record payout</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Payout to {ownerName}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            execute({
              ledgerAccountId,
              amountRupees: Number(form.get("amount")),
              reference: String(form.get("reference") || "") || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹) — balance {balanceRupees.toLocaleString("en-IN")}</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={1}
              max={balanceRupees}
              step="0.01"
              defaultValue={balanceRupees}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference">Bank/UPI reference</Label>
            <Input id="reference" name="reference" placeholder="UTR / transaction id" />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Recording…" : "Record as paid"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
