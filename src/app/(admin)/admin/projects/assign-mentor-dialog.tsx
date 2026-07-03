"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { assignMentorToInstance } from "@/actions/mentor";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AssignMentorDialog({
  projectInstanceId,
  mentors,
}: {
  projectInstanceId: string;
  mentors: Array<{ id: string; label: string; atCapacity: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [mentorId, setMentorId] = useState("");
  const { execute, isPending } = useAction(assignMentorToInstance, {
    onSuccess: () => {
      toast.success("Mentor assigned + kickoff scheduled");
      setOpen(false);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Assign mentor</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign mentor & schedule kickoff</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            if (!mentorId) {
              toast.error("Pick a mentor");
              return;
            }
            execute({
              projectInstanceId,
              mentorProfileId: mentorId,
              kickoffAt: new Date(String(form.get("kickoffAt"))),
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Mentor</Label>
            <Select value={mentorId} onValueChange={(v) => setMentorId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a vetted mentor" />
              </SelectTrigger>
              <SelectContent>
                {mentors.map((m) => (
                  <SelectItem key={m.id} value={m.id} disabled={m.atCapacity}>
                    {m.label}
                    {m.atCapacity ? " (at capacity)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kickoffAt">Kickoff (sets the refund cutoff)</Label>
            <Input id="kickoffAt" name="kickoffAt" type="datetime-local" required />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Assigning…" : "Assign & schedule"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
