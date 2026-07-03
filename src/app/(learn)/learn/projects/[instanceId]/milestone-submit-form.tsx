"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { submitMilestone } from "@/actions/project-work";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function MilestoneSubmitForm({
  projectInstanceId,
  milestoneId,
}: {
  projectInstanceId: string;
  milestoneId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(submitMilestone, {
    onSuccess: () => {
      toast.success("Submitted for mentor review");
      setOpen(false);
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Submission failed"),
  });

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Submit this milestone
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        execute({
          projectInstanceId,
          milestoneId,
          notes: String(form.get("notes") || "") || undefined,
          repoUrl: String(form.get("repoUrl") || ""),
          artifactUrl: String(form.get("artifactUrl") || ""),
        });
      }}
      className="space-y-3 rounded-md border p-3"
    >
      <Input name="repoUrl" type="url" placeholder="Repository URL" />
      <Input name="artifactUrl" type="url" placeholder="Demo / artifact URL (optional)" />
      <Textarea
        name="notes"
        rows={3}
        placeholder="What you built, decisions you made, what to look at first…"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Submitting…" : "Submit for review"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
