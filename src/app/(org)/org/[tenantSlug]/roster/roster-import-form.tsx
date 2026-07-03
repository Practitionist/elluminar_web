"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { importRoster } from "@/actions/roster";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RosterImportForm({
  tenantSlug,
  licenseId,
}: {
  tenantSlug: string;
  licenseId: string;
}) {
  const [open, setOpen] = useState(false);
  const [rejected, setRejected] = useState<Array<{ email: string; reason: string }>>([]);

  const { execute, isPending } = useAction(importRoster, {
    onSuccess({ data }) {
      if (!data) return;
      toast.success(
        `Imported: ${data.invited} invited, ${data.alreadySeated} already seated` +
          (data.rejected.length ? `, ${data.rejected.length} rejected` : ""),
      );
      setRejected(data.rejected);
      if (data.rejected.length === 0) setOpen(false);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Import failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Import CSV
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import roster</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setRejected([]);
            execute({ tenantSlug, licenseId, csv: String(form.get("csv")) });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="csv">Paste CSV — one `email,name` per line</Label>
            <Textarea
              id="csv"
              name="csv"
              rows={8}
              required
              placeholder={"email,name\npriya@acme.com,Priya Sharma\nrohan@acme.com,Rohan Iyer"}
              className="font-mono text-xs"
            />
          </div>
          {rejected.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-md border border-destructive/40 p-2 text-xs">
              {rejected.map((r, i) => (
                <p key={i}>
                  <span className="font-mono">{r.email}</span> — {r.reason}
                </p>
              ))}
            </div>
          )}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Importing…" : "Import"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Re-imports are idempotent. Invitees get an email; their seat
            activates on first verified sign-in.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
