"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { reviewCourse } from "@/actions/course";
import { Button } from "@/components/ui/button";

export function CourseReviewButtons({ courseId }: { courseId: string }) {
  const { execute, isPending } = useAction(reviewCourse, {
    onSuccess: () => toast.success("Decision recorded"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" disabled={isPending} onClick={() => execute({ courseId, decision: "PUBLISHED" })}>
        Publish
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => execute({ courseId, decision: "DRAFT" })}
      >
        Send back
      </Button>
    </div>
  );
}
