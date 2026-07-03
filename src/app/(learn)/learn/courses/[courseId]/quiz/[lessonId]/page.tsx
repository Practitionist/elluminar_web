import Link from "next/link";
import { notFound } from "next/navigation";

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
      <div className="mx-auto max-w-2xl">
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
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-8 text-center">
      <Link
        href={`/learn/courses/${courseId}?lesson=${lessonId}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to course
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{quiz.title}</h1>
      <p className="text-sm text-muted-foreground">
        {quiz.drawCount ?? quiz._count.questions} questions · pass at {quiz.passPct}%
        {quiz.timeLimitSec ? ` · ${Math.round(quiz.timeLimitSec / 60)} minutes` : ""}
      </p>
      {quiz.attempts.length > 0 && (
        <div className="space-y-1 text-sm text-muted-foreground">
          {quiz.attempts.slice(0, 5).map((a) => (
            <p key={a.id}>
              Attempt {a.attemptNo}: {a.scorePoints}/{a.maxPoints} —{" "}
              {a.passed ? "passed ✓" : "not passed"}
            </p>
          ))}
        </div>
      )}
      {attemptsLeft === 0 ? (
        <p className="font-medium">No attempts remaining.</p>
      ) : (
        <StartQuizButton courseId={courseId} lessonId={lessonId} />
      )}
    </div>
  );
}
