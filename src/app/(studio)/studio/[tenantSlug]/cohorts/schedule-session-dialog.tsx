"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { scheduleLiveSession } from "@/actions/live";
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

export function ScheduleSessionDialog({
  tenantSlug,
  cohortId,
}: {
  tenantSlug: string;
  cohortId: string;
}) {
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(scheduleLiveSession, {
    onSuccess: () => {
      toast.success("Session scheduled — learners have been notified.");
      setOpen(false);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            + Live session
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule a live session</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            execute({
              tenantSlug,
              cohortId,
              title: String(form.get("title")),
              scheduledStartAt: new Date(String(form.get("startsAt"))),
              durationMin: Number(form.get("durationMin") || 90),
              joinUrl: String(form.get("joinUrl") || ""),
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Week 3: System design deep-dive" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startsAt">Starts</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMin">Duration (min)</Label>
              <Input id="durationMin" name="durationMin" type="number" min={15} defaultValue={90} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="joinUrl">External link (optional)</Label>
            <Input id="joinUrl" name="joinUrl" type="url" placeholder="Zoom/Meet link — leave empty to use Fermion" />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Scheduling…" : "Schedule"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
