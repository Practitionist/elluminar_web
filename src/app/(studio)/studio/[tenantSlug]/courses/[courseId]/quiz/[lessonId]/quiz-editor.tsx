"use client";

import { Check, Circle, Pencil, Plus, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { deleteQuizQuestion, upsertQuiz, upsertQuizQuestion } from "@/actions/course";
import { Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type QuestionRow = {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  correct: { index?: number; indexes?: number[]; text?: string };
  points: number;
  explanation: string;
  poolTag: string;
};

type QuizData = {
  id: string;
  title: string;
  passPct: number;
  maxAttempts: number | null;
  timeLimitSec: number | null;
  drawCount: number | null;
  shuffleQuestions: boolean;
  showAnswers: string;
  questions: QuestionRow[];
};

export function QuizEditor({
  tenantSlug,
  courseId,
  lessonId,
  quiz,
}: {
  tenantSlug: string;
  courseId: string;
  lessonId: string;
  quiz: QuizData;
}) {
  const settings = useAction(upsertQuiz, {
    onSuccess: () => toast.success("Quiz settings saved"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  const removeQuestion = useAction(deleteQuizQuestion, {
    onSuccess: () => toast.success("Question deleted"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  function saveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    settings.execute({
      tenantSlug,
      courseId,
      lessonId,
      title: String(form.get("title")),
      passPct: Number(form.get("passPct")),
      maxAttempts: form.get("maxAttempts") ? Number(form.get("maxAttempts")) : null,
      timeLimitSec: form.get("timeLimitMin") ? Number(form.get("timeLimitMin")) * 60 : null,
      drawCount: form.get("drawCount") ? Number(form.get("drawCount")) : null,
      shuffleQuestions: true,
      showAnswers: "AFTER_ATTEMPT",
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {quiz.questions.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold">
                  Q{i + 1}. {q.prompt}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill tone="neutral">{q.type.toLowerCase().replace("_", " ")}</Pill>
                  <Pill tone="primary">{q.points} pts</Pill>
                  {q.poolTag && <Pill tone="info">bank: {q.poolTag}</Pill>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <QuestionDialog
                  tenantSlug={tenantSlug}
                  courseId={courseId}
                  quizId={quiz.id}
                  question={q}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    removeQuestion.execute({
                      tenantSlug,
                      courseId,
                      quizId: quiz.id,
                      questionId: q.id,
                    })
                  }
                >
                  <X />
                </Button>
              </div>
            </div>
            {q.options.length > 0 && (
              <div className="mt-3 space-y-1 text-sm">
                {q.options.map((opt, oi) => {
                  const isCorrect =
                    q.correct.index === oi || q.correct.indexes?.includes(oi);
                  return (
                    <div
                      key={oi}
                      className={
                        isCorrect
                          ? "flex items-center gap-1.5 font-semibold text-success-subtle-foreground"
                          : "flex items-center gap-1.5 text-muted-foreground"
                      }
                    >
                      {isCorrect ? (
                        <Check className="size-3.5 shrink-0" />
                      ) : (
                        <Circle className="size-3.5 shrink-0" />
                      )}
                      {opt}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        <QuestionDialog tenantSlug={tenantSlug} courseId={courseId} quizId={quiz.id} />
      </div>

      <div className="h-fit rounded-2xl border border-border bg-card p-5">
        <div className="text-base font-extrabold">Quiz settings</div>
        <form onSubmit={saveSettings} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={quiz.title} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="passPct">Pass %</Label>
              <Input id="passPct" name="passPct" type="number" min={0} max={100} defaultValue={quiz.passPct} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxAttempts">Max attempts</Label>
              <Input id="maxAttempts" name="maxAttempts" type="number" min={1} defaultValue={quiz.maxAttempts ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeLimitMin">Time limit (min)</Label>
              <Input id="timeLimitMin" name="timeLimitMin" type="number" min={1} defaultValue={quiz.timeLimitSec ? quiz.timeLimitSec / 60 : ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drawCount">Draw N random</Label>
              <Input id="drawCount" name="drawCount" type="number" min={1} defaultValue={quiz.drawCount ?? ""} />
            </div>
          </div>
          <Button type="submit" disabled={settings.isPending} className="w-full rounded-full">
            {settings.isPending ? "Saving…" : "Save settings"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function QuestionDialog({
  tenantSlug,
  courseId,
  quizId,
  question,
}: {
  tenantSlug: string;
  courseId: string;
  quizId: string;
  question?: QuestionRow;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(question?.type ?? "SINGLE_CHOICE");
  const [options, setOptions] = useState<string[]>(
    question?.options.length ? question.options : ["", ""],
  );
  const [correct, setCorrect] = useState<number[]>(
    question?.correct.indexes ??
      (question?.correct.index != null ? [question.correct.index] : []),
  );

  const { execute, isPending } = useAction(upsertQuizQuestion, {
    onSuccess: () => {
      toast.success("Question saved");
      setOpen(false);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  function toggleCorrect(index: number) {
    setCorrect((prev) => {
      if (type === "MULTI_CHOICE") {
        return prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index];
      }
      return [index];
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const opts = type === "TRUE_FALSE" ? ["True", "False"] : options.filter(Boolean);
    execute({
      tenantSlug,
      courseId,
      quizId,
      questionId: question?.id,
      type: type as never,
      prompt: String(form.get("prompt")),
      options: type === "SHORT_TEXT" ? [] : opts,
      correctIndexes: type === "SHORT_TEXT" ? [] : correct,
      correctText: type === "SHORT_TEXT" ? String(form.get("correctText") || "") : undefined,
      points: Number(form.get("points") || 1),
      explanation: String(form.get("explanation") || "") || undefined,
      poolTag: String(form.get("poolTag") || "") || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          question ? (
            <Button variant="ghost" size="icon-sm">
              <Pencil />
            </Button>
          ) : (
            <Button variant="outline" className="rounded-full">
              <Plus className="size-3.5" />
              Add question
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{question ? "Edit question" : "Add question"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v ?? "SINGLE_CHOICE");
                setCorrect([]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SINGLE_CHOICE">Single choice</SelectItem>
                <SelectItem value="MULTI_CHOICE">Multiple choice</SelectItem>
                <SelectItem value="TRUE_FALSE">True / False</SelectItem>
                <SelectItem value="SHORT_TEXT">Short text</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt">Question</Label>
            <Textarea id="prompt" name="prompt" rows={3} defaultValue={question?.prompt} required />
          </div>

          {type === "TRUE_FALSE" && (
            <div className="space-y-2">
              <Label>Correct answer</Label>
              <div className="flex gap-4">
                {["True", "False"].map((label, i) => (
                  <label key={label} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={correct[0] === i} onCheckedChange={() => toggleCorrect(i)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {(type === "SINGLE_CHOICE" || type === "MULTI_CHOICE") && (
            <div className="space-y-2">
              <Label>Options (check the correct ones)</Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox checked={correct.includes(i)} onCheckedChange={() => toggleCorrect(i)} />
                  <Input
                    value={opt}
                    onChange={(e) =>
                      setOptions((prev) => prev.map((p, pi) => (pi === i ? e.target.value : p)))
                    }
                    placeholder={`Option ${i + 1}`}
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setOptions((prev) => prev.filter((_, pi) => pi !== i));
                        setCorrect((prev) => prev.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)));
                      }}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              ))}
              {options.length < 8 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setOptions((p) => [...p, ""])}
                >
                  <Plus className="size-3.5" />
                  Option
                </Button>
              )}
            </div>
          )}

          {type === "SHORT_TEXT" && (
            <div className="space-y-2">
              <Label htmlFor="correctText">Expected answer</Label>
              <Input id="correctText" name="correctText" defaultValue={question?.correct.text ?? ""} />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="points">Points</Label>
              <Input id="points" name="points" type="number" min={1} defaultValue={question?.points ?? 1} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="poolTag">Question bank tag</Label>
              <Input id="poolTag" name="poolTag" defaultValue={question?.poolTag} placeholder="optional" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="explanation">Explanation (shown after attempt)</Label>
            <Textarea id="explanation" name="explanation" rows={2} defaultValue={question?.explanation} />
          </div>
          <Button type="submit" disabled={isPending} className="w-full rounded-full">
            {isPending ? "Saving…" : "Save question"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
