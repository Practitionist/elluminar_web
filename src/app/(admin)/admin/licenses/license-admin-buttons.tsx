"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { activateLicense, recordLicensePayment } from "@/actions/license";
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

export function LicenseAdminButtons({
  licenseId,
  status,
  suggestedRupees,
}: {
  licenseId: string;
  status: string;
  suggestedRupees?: number;
}) {
  const [open, setOpen] = useState(false);
  const payment = useAction(recordLicensePayment, {
    onSuccess: () => {
      toast.success("Payment recorded" + (status === "DRAFT" ? " — license activated" : ""));
      setOpen(false);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  const activate = useAction(activateLicense, {
    onSuccess: () => toast.success("License activated"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button size="sm" variant="outline">
              Record payment
            </Button>
          }
        />
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record contract payment</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              payment.execute({
                licenseId,
                amountRupees: Number(form.get("amount")),
                reference: String(form.get("reference") || "") || undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min={1}
                step="0.01"
                defaultValue={suggestedRupees}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Bank/UTR reference</Label>
              <Input id="reference" name="reference" />
            </div>
            <Button type="submit" disabled={payment.isPending} className="w-full">
              {payment.isPending ? "Recording…" : "Record"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {status === "DRAFT" && (
        <Button
          size="sm"
          disabled={activate.isPending}
          onClick={() => activate.execute({ licenseId })}
        >
          Activate (pilot)
        </Button>
      )}
    </div>
  );
}
