"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { startQuizAttempt } from "@/actions/learning";
import { Button } from "@/components/ui/button";

export function StartQuizButton({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const router = useRouter();
  const { execute, isPending } = useAction(startQuizAttempt, {
    onSuccess: () => router.refresh(),
    onError: ({ error }) => toast.error(error.serverError ?? "Could not start"),
  });

  return (
    <Button size="lg" disabled={isPending} onClick={() => execute({ courseId, lessonId })}>
      {isPending ? "Starting…" : "Start attempt"}
    </Button>
  );
}
