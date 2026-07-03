"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { finalizeProjectInstance, reviewMilestoneSubmission } from "@/actions/project-work";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReviewForm({
  projectReviewId,
  criteria,
}: {
  projectReviewId: string;
  criteria: Array<{ id: string; name: string; weightPct: number }>;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>({});
  const { execute, isPending } = useAction(reviewMilestoneSubmission, {
    onSuccess: () => {
      toast.success("Review submitted");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  function submit(decision: "APPROVED" | "CHANGES_REQUESTED", form: HTMLFormElement) {
    const data = new FormData(form);
    const summary = String(data.get("summary") || "");
    if (summary.length < 10) {
      toast.error("Write at least a couple of sentences of feedback.");
      return;
    }
    const rubricScores = criteria
      .filter((c) => scores[c.id] != null)
      .map((c) => ({
        rubricCriterionId: c.id,
        score: scores[c.id],
        maxScore: c.weightPct,
      }));
    const overall = rubricScores.length
      ? rubricScores.reduce((s, r) => s + r.score, 0)
      : undefined;
    execute({ projectReviewId, decision, summary, overallScore: overall, rubricScores });
  }

  return (
    <form className="space-y-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {criteria.map((c) => (
          <div key={c.id} className="space-y-1">
            <Label className="text-xs">
              {c.name} (/{c.weightPct})
            </Label>
            <Input
              type="number"
              min={0}
              max={c.weightPct}
              value={scores[c.id] ?? ""}
              onChange={(e) =>
                setScores((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))
              }
            />
          </div>
        ))}
      </div>
      <Textarea
        name="summary"
        rows={4}
        placeholder="What's strong, what must change, and why — the learner sees this verbatim."
        required
      />
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={isPending}
          onClick={(e) => submit("APPROVED", e.currentTarget.form!)}
        >
          Approve milestone
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={(e) => submit("CHANGES_REQUESTED", e.currentTarget.form!)}
        >
          Request changes
        </Button>
      </div>
    </form>
  );
}

export function FinalizeForm({ projectInstanceId }: { projectInstanceId: string }) {
  const router = useRouter();
  const { execute, isPending } = useAction(finalizeProjectInstance, {
    onSuccess: () => {
      toast.success("Final verdict recorded");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  function submit(decision: "PASS" | "FAIL", form: HTMLFormElement) {
    const data = new FormData(form);
    const summary = String(data.get("finalSummary") || "");
    const finalScore = Number(data.get("finalScore") || 0);
    if (summary.length < 20) {
      toast.error("The final summary needs at least a few sentences.");
      return;
    }
    if (
      !window.confirm(
        decision === "PASS"
          ? "Confirm PASS? This issues the credential and your mentor fee."
          : "Confirm FAIL? This finalizes the project.",
      )
    )
      return;
    execute({ projectInstanceId, decision, summary, finalScore });
  }

  return (
    <form className="space-y-3">
      <div className="flex items-center gap-3">
        <Label htmlFor="finalScore" className="shrink-0">
          Final score (%)
        </Label>
        <Input id="finalScore" name="finalScore" type="number" min={0} max={100} className="w-24" />
      </div>
      <Textarea
        name="finalSummary"
        rows={4}
        placeholder="Overall assessment: production-readiness, strengths, growth areas."
      />
      <div className="flex gap-2">
        <Button type="button" disabled={isPending} onClick={(e) => submit("PASS", e.currentTarget.form!)}>
          {isPending ? "Saving…" : "PASS — verify this work"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={isPending}
          onClick={(e) => submit("FAIL", e.currentTarget.form!)}
        >
          FAIL
        </Button>
      </div>
    </form>
  );
}
