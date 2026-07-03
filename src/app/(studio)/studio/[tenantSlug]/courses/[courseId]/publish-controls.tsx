"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { submitCourseForReview } from "@/actions/course";
import { Button } from "@/components/ui/button";

export function PublishControls({
  tenantSlug,
  courseId,
  status,
}: {
  tenantSlug: string;
  courseId: string;
  status: string;
}) {
  const { execute, isPending } = useAction(submitCourseForReview, {
    onSuccess: () => toast.success("Submitted for review"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  if (status === "PUBLISHED") {
    return <span className="text-sm text-muted-foreground">Live in the catalog</span>;
  }
  if (status === "IN_REVIEW") {
    return <span className="text-sm text-muted-foreground">Awaiting moderation</span>;
  }
  return (
    <Button onClick={() => execute({ tenantSlug, courseId })} disabled={isPending}>
      {isPending ? "Submitting…" : "Submit for review"}
    </Button>
  );
}
