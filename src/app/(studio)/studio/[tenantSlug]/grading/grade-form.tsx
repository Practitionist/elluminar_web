"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { gradeAssignmentSubmission } from "@/actions/learning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GradeForm({
  submissionId,
  maxPoints,
}: {
  submissionId: string;
  maxPoints: number;
}) {
  const router = useRouter();
  const { execute, isPending } = useAction(gradeAssignmentSubmission, {
    onSuccess: ({ data }) => {
      toast.success(
        data?.resubmission
          ? "Resubmission requested — learner notified."
          : "Graded — lesson completed for the learner.",
      );
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed to grade"),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    // `new FormData(form)` deliberately omits the submitter button, so reading
    // form.get("intent") always yielded null and "Request changes" silently
    // behaved exactly like "Grade" — completing the lesson instead of asking
    // for a resubmission. The intent has to come off the submitter itself.
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    execute({
      submissionId,
      scorePoints: Number(form.get("score") || 0),
      feedback: String(form.get("feedback") || "") || undefined,
      requestResubmission: submitter?.value === "resubmit",
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
      <div className="w-24 space-y-1.5">
        <Label htmlFor={`score-${submissionId}`}>Score</Label>
        <Input
          id={`score-${submissionId}`}
          name="score"
          type="number"
          min={0}
          max={maxPoints}
          required
        />
      </div>
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor={`feedback-${submissionId}`}>Feedback (optional)</Label>
        <Input id={`feedback-${submissionId}`} name="feedback" placeholder="What went well / what to fix" />
      </div>
      <Button type="submit" name="intent" value="grade" disabled={isPending} className="rounded-full">
        Grade
      </Button>
      <Button
        type="submit"
        name="intent"
        value="resubmit"
        variant="outline"
        disabled={isPending}
        className="rounded-full"
      >
        Request changes
      </Button>
    </form>
  );
}
