import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pill } from "@/components/shared";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getAttemptQuestions } from "@/lib/learning/quiz";

import { QuizRunner } from "./quiz-runner";
import { StartQuizButton } from "./start-quiz-button";

export const metadata = { title: "Quiz" };

export default async function QuizAttemptPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const session = await requireUser(`/learn/courses/${courseId}/quiz/${lessonId}`);

  const quiz = await db.quiz.findUnique({
    where: { lessonId },
    include: {
      attempts: {
        where: { userId: session.user.id },
        orderBy: { attemptNo: "desc" },
      },
      _count: { select: { questions: true } },
    },
  });
  if (!quiz) notFound();

  const openAttempt = quiz.attempts.find((a) => !a.submittedAt);
  const attemptsUsed = quiz.attempts.length;
  const attemptsLeft =
    quiz.maxAttempts != null ? Math.max(0, quiz.maxAttempts - attemptsUsed) : null;

  if (openAttempt) {
    const data = await getAttemptQuestions(openAttempt.id, session.user.id);
    if (!data) notFound();
    return (
      <div className="space-y-6">
        <div className="mx-auto w-full max-w-2xl">
          <QuizRunner
            attemptId={openAttempt.id}
            courseId={courseId}
            lessonId={lessonId}
            title={quiz.title}
            passPct={quiz.passPct}
            dueAt={data.attempt.dueAt?.toISOString() ?? null}
            questions={data.questions}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <Link
          href={`/learn/courses/${courseId}?lesson=${lessonId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to course
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Pill tone="primary" className="uppercase tracking-wide">
            Quiz
          </Pill>
          <h1 className="mt-3 font-display text-2xl font-medium tracking-tight sm:text-3xl">
            {quiz.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {quiz.drawCount ?? quiz._count.questions} questions · pass at {quiz.passPct}%
            {quiz.timeLimitSec ? ` · ${Math.round(quiz.timeLimitSec / 60)} minutes` : ""}
          </p>

          {quiz.attempts.length > 0 && (
            <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm text-muted-foreground">
              {quiz.attempts.slice(0, 5).map((a) => (
                <p key={a.id}>
                  Attempt {a.attemptNo}: {a.scorePoints}/{a.maxPoints} —{" "}
                  {a.passed ? "passed ✓" : "not passed"}
                </p>
              ))}
            </div>
          )}

          <div className="mt-5">
            {attemptsLeft === 0 ? (
              <Pill tone="destructive">No attempts remaining</Pill>
            ) : (
              <StartQuizButton courseId={courseId} lessonId={lessonId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
