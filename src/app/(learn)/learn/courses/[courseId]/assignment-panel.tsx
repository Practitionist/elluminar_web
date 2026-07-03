"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { submitAssignment } from "@/actions/learning";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{assignment.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-line text-sm">{assignment.instructions}</p>
          <p className="text-xs text-muted-foreground">
            Worth {assignment.maxPoints} points · instructor-reviewed
          </p>
        </CardContent>
      </Card>

      {submissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your submissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {submissions.map((s) => (
              <div key={s.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Attempt {s.attemptNo}</span>
                  <div className="flex items-center gap-2">
                    {s.scorePoints != null && (
                      <span className="font-medium">
                        {s.scorePoints}/{s.maxPoints}
                      </span>
                    )}
                    <Badge variant="outline">
                      {s.status.toLowerCase().replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
                {s.feedback && (
                  <p className="mt-1 text-xs text-muted-foreground">“{s.feedback}”</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canSubmit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {latest ? "Resubmit your work" : "Submit your work"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
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
              <Button type="submit" disabled={isPending}>
                {isPending ? "Submitting…" : "Submit"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
