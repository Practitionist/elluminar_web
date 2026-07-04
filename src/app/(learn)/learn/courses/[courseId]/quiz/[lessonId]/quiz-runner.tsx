"use client";

import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { submitQuizAttempt } from "@/actions/learning";
import { Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type Question = {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  points: number;
};

type Answer = number | number[] | string;

export function QuizRunner({
  attemptId,
  courseId,
  lessonId,
  title,
  passPct,
  dueAt,
  questions,
}: {
  attemptId: string;
  courseId: string;
  lessonId: string;
  title: string;
  passPct: number;
  dueAt: string | null;
  questions: Question[];
}) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<{
    score: number;
    maxPoints: number;
    passed: boolean;
  } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const { execute, isPending } = useAction(submitQuizAttempt, {
    onSuccess: ({ data }) => {
      if (data) setResult(data);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Submit failed"),
  });

  useEffect(() => {
    if (!dueAt || result) return;
    const tick = () => {
      const left = Math.floor((new Date(dueAt).getTime() - Date.now()) / 1000);
      setSecondsLeft(left);
      if (left <= 0) {
        execute({ attemptId, answers });
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueAt, result]);

  if (result) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Pill tone={result.passed ? "success" : "distinction"}>
          {result.passed ? "Passed 🎉" : "Not this time"}
        </Pill>
        <p className="mt-4 text-3xl font-extrabold tabular-nums">
          {result.score}/{result.maxPoints}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Pass mark: {passPct}%.{" "}
          {result.passed
            ? "This lesson is now marked complete."
            : "Review the material and try again."}
        </p>
        <Button
          render={<Link href={`/learn/courses/${courseId}?lesson=${lessonId}`} />}
          className="mt-5 rounded-full"
        >
          Back to course
        </Button>
      </div>
    );
  }

  const setAnswer = (qid: string, value: Answer) =>
    setAnswers((prev) => ({ ...prev, [qid]: value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-medium tracking-tight">{title}</h1>
        {secondsLeft != null && (
          <Pill tone={secondsLeft < 60 ? "destructive" : "neutral"} className="font-mono">
            {Math.max(0, Math.floor(secondsLeft / 60))}:
            {String(Math.max(0, secondsLeft % 60)).padStart(2, "0")}
          </Pill>
        )}
      </div>

      {questions.map((q, i) => (
        <div key={q.id} className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-bold">
            {i + 1}. {q.prompt}{" "}
            <span className="font-semibold text-muted-foreground">({q.points} pts)</span>
          </p>
          <div className="mt-3 space-y-2">
            {(q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE") &&
              q.options.map((opt, oi) => (
                <label key={oi} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === oi}
                    onChange={() => setAnswer(q.id, oi)}
                    className="accent-primary"
                  />
                  {opt}
                </label>
              ))}
            {q.type === "MULTI_CHOICE" &&
              q.options.map((opt, oi) => {
                const current = Array.isArray(answers[q.id])
                  ? (answers[q.id] as number[])
                  : [];
                return (
                  <label key={oi} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={current.includes(oi)}
                      onCheckedChange={(checked) =>
                        setAnswer(
                          q.id,
                          checked
                            ? [...current, oi]
                            : current.filter((v) => v !== oi),
                        )
                      }
                    />
                    {opt}
                  </label>
                );
              })}
            {q.type === "SHORT_TEXT" && (
              <Input
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Your answer"
              />
            )}
          </div>
        </div>
      ))}

      <Button
        className="w-full rounded-full"
        size="lg"
        disabled={isPending}
        onClick={() => execute({ attemptId, answers })}
      >
        {isPending ? "Grading…" : "Submit answers"}
      </Button>
    </div>
  );
}
