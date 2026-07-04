"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { submitAssignment } from "@/actions/learning";
import { Pill, type PillTone } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SUBMISSION_STATUS_TONE: Record<string, PillTone> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  GRADING: "info",
  GRADED: "success",
  RETURNED: "neutral",
  RESUBMIT_REQUESTED: "distinction",
};

export function AssignmentPanel({
  courseId,
  lessonId,
  assignment,
  submissions,
}: {
  courseId: string;
  lessonId: string;
  assignment: {
    title: string;
    instructions: string;
    maxPoints: number;
    submissionKinds: string[];
    allowResubmission: boolean;
  };
  submissions: Array<{
    id: string;
    attemptNo: number;
    status: string;
    scorePoints: number | null;
    maxPoints: number;
    feedback: string | null;
    submittedAt: string | null;
  }>;
}) {
  const router = useRouter();
  const { execute, isPending } = useAction(submitAssignment, {
    onSuccess: () => {
      toast.success("Submitted — your instructor will review it.");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Submission failed"),
  });

  const latest = submissions[0];
  const canSubmit =
    !latest ||
    (assignment.allowResubmission &&
      (latest.status === "GRADED" || latest.status === "RESUBMIT_REQUESTED"));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    execute({
      courseId,
      lessonId,
      text: String(form.get("text") || "") || undefined,
      repoUrl: String(form.get("repoUrl") || ""),
      url: String(form.get("url") || ""),
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-extrabold">{assignment.title}</h2>
        <p className="mt-3 text-sm whitespace-pre-line">{assignment.instructions}</p>
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          Worth {assignment.maxPoints} points · instructor-reviewed
        </p>
      </div>

      {submissions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-extrabold">Your submissions</h2>
          <div className="mt-3 space-y-2">
            {submissions.map((s) => (
              <div key={s.id} className="rounded-lg border border-border px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Attempt {s.attemptNo}</span>
                  <div className="flex items-center gap-2">
                    {s.scorePoints != null && (
                      <span className="font-bold tabular-nums">
                        {s.scorePoints}/{s.maxPoints}
                      </span>
                    )}
                    <Pill tone={SUBMISSION_STATUS_TONE[s.status] ?? "neutral"}>
                      {s.status.toLowerCase().replace(/_/g, " ")}
                    </Pill>
                  </div>
                </div>
                {s.feedback && (
                  <p className="mt-1.5 text-xs text-muted-foreground">“{s.feedback}”</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {canSubmit && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-extrabold">
            {latest ? "Resubmit your work" : "Submit your work"}
          </h2>
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            {assignment.submissionKinds.includes("TEXT") && (
              <div className="space-y-2">
                <Label htmlFor="text">Answer</Label>
                <Textarea id="text" name="text" rows={6} />
              </div>
            )}
            {assignment.submissionKinds.includes("REPO_URL") && (
              <div className="space-y-2">
                <Label htmlFor="repoUrl">Repository URL</Label>
                <Input id="repoUrl" name="repoUrl" type="url" placeholder="https://github.com/…" />
              </div>
            )}
            {assignment.submissionKinds.includes("URL") && (
              <div className="space-y-2">
                <Label htmlFor="url">Link</Label>
                <Input id="url" name="url" type="url" />
              </div>
            )}
            <Button type="submit" disabled={isPending} className="rounded-full">
              {isPending ? "Submitting…" : "Submit"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
