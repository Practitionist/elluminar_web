"use client";

import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { submitQuizAttempt } from "@/actions/learning";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="text-center">
        <CardHeader>
          <CardTitle>{result.passed ? "Passed 🎉" : "Not this time"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-3xl font-semibold">
            {result.score}/{result.maxPoints}
          </p>
          <p className="text-sm text-muted-foreground">
            Pass mark: {passPct}%.{" "}
            {result.passed
              ? "This lesson is now marked complete."
              : "Review the material and try again."}
          </p>
          <Button render={<Link href={`/learn/courses/${courseId}?lesson=${lessonId}`} />}>
            Back to course
          </Button>
        </CardContent>
      </Card>
    );
  }

  const setAnswer = (qid: string, value: Answer) =>
    setAnswers((prev) => ({ ...prev, [qid]: value }));

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {secondsLeft != null && (
          <Badge variant={secondsLeft < 60 ? "destructive" : "outline"}>
            {Math.max(0, Math.floor(secondsLeft / 60))}:
            {String(Math.max(0, secondsLeft % 60)).padStart(2, "0")}
          </Badge>
        )}
      </div>

      {questions.map((q, i) => (
        <Card key={q.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {i + 1}. {q.prompt}{" "}
              <span className="font-normal text-muted-foreground">({q.points} pts)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE") &&
              q.options.map((opt, oi) => (
                <label key={oi} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === oi}
                    onChange={() => setAnswer(q.id, oi)}
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
          </CardContent>
        </Card>
      ))}

      <Button
        className="w-full"
        size="lg"
        disabled={isPending}
        onClick={() => execute({ attemptId, answers })}
      >
        {isPending ? "Grading…" : "Submit answers"}
      </Button>
    </div>
  );
}
