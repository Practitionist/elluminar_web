"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { reviewProject } from "@/actions/projects";
import { Button } from "@/components/ui/button";

export function ProjectReviewButtons({ projectId }: { projectId: string }) {
  const { execute, isPending } = useAction(reviewProject, {
    onSuccess: () => toast.success("Decision recorded"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" disabled={isPending} onClick={() => execute({ projectId, decision: "PUBLISHED" })}>
        Publish
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => execute({ projectId, decision: "DRAFT" })}
      >
        Send back
      </Button>
    </div>
  );
}
