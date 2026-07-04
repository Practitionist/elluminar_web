"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { submitCourseForReview } from "@/actions/course";
import { Pill } from "@/components/shared";
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
    return <Pill tone="success">Live in the catalog</Pill>;
  }
  if (status === "IN_REVIEW") {
    return <Pill tone="distinction">Awaiting moderation</Pill>;
  }
  return (
    <Button
      onClick={() => execute({ tenantSlug, courseId })}
      disabled={isPending}
      className="rounded-full"
    >
      {isPending ? "Submitting…" : "Submit for review"}
    </Button>
  );
}
