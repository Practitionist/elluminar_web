"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { markLessonProgress } from "@/actions/learning";
import { Button } from "@/components/ui/button";

export function MarkCompleteButton({
  courseId,
  lessonId,
  completed,
}: {
  courseId: string;
  lessonId: string;
  completed: boolean;
}) {
  const router = useRouter();
  const { execute, isPending } = useAction(markLessonProgress, {
    onSuccess: () => router.refresh(),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  if (completed) {
    return (
      <Button variant="outline" size="sm" disabled>
        Completed ✓
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() => execute({ courseId, lessonId, status: "COMPLETED" })}
    >
      {isPending ? "Saving…" : "Mark complete"}
    </Button>
  );
}
