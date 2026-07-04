"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { markLessonProgress } from "@/actions/learning";
import { Pill } from "@/components/shared";
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
      <Pill tone="success" className="px-3 py-1.5">
        <Check className="size-3.5" />
        Completed
      </Pill>
    );
  }
  return (
    <Button
      size="sm"
      className="rounded-full"
      disabled={isPending}
      onClick={() => execute({ courseId, lessonId, status: "COMPLETED" })}
    >
      {isPending ? "Saving…" : "Mark complete"}
    </Button>
  );
}
