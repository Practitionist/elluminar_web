import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssessmentHeader, Pill } from "@/components/shared";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getAttemptQuestions } from "@/lib/learning/quiz";

import { QuizRunner } from "./quiz-runner";
import { StartQuizButton } from "./start-quiz-button";

/** Course + section + position, so the page can say where the learner is. */
async function loadContext(lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      title: true,
      position: true,
      section: { select: { title: true, position: true } },
      course: { select: { id: true, title: true } },
    },
  });
  if (!lesson) return null;
  const [total, before] = await Promise.all([
    db.lesson.count({ where: { courseId: lesson.course.id } }),
    db.lesson.count({
      where: {
        courseId: lesson.course.id,
        OR: [
          { section: { position: { lt: lesson.section?.position ?? 0 } } },
          {
            section: { position: lesson.section?.position ?? 0 },
            position: { lt: lesson.position },
          },
        ],
      },
    }),
  ]);
  return { lesson, position: `Lesson ${before + 1} of ${total}` };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const ctx = await loadContext(lessonId);
  if (!ctx) return { title: "Quiz" };
  return { title: `${ctx.lesson.title} · ${ctx.lesson.course.title}` };
}

export default async function QuizAttemptPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const session = await requireUser(`/learn/courses/${courseId}/quiz/${lessonId}`);

  const [quiz, ctx] = await Promise.all([
    db.quiz.findUnique({
      where: { lessonId },
      include: {
        attempts: { where: { userId: session.user.id }, orderBy: { attemptNo: "desc" } },
        _count: { select: { questions: true } },
      },
    }),
    loadContext(lessonId),
  ]);
  if (!quiz || !ctx) notFound();

  const courseHref = `/learn/courses/${courseId}?lesson=${lessonId}`;
  const openAttempt = quiz.attempts.find((a) => !a.submittedAt);
  const attemptsUsed = quiz.attempts.length;
  const attemptsLeft =
    quiz.maxAttempts != null ? Math.max(0, quiz.maxAttempts - attemptsUsed) : null;
  const questionCount = quiz.drawCount ?? quiz._count.questions;
  const best = quiz.attempts
    .filter((a) => a.submittedAt)
    .sort((a, b) => (b.scorePoints ?? 0) - (a.scorePoints ?? 0))[0];

  if (openAttempt) {
    const data = await getAttemptQuestions(openAttempt.id, session.user.id);
    if (!data) notFound();
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <AssessmentHeader
          kind="QUIZ"
          title={quiz.title}
          courseTitle={ctx.lesson.course.title}
          courseHref={courseHref}
          sectionTitle={ctx.lesson.section?.title}
          position={ctx.position}
          stakesOverride="Attempt in progress — answers are marked as soon as you submit."
        />
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
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Link
        href={courseHref}
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to course
      </Link>

      <AssessmentHeader
        kind="QUIZ"
        title={quiz.title}
        courseTitle={ctx.lesson.course.title}
        courseHref={courseHref}
        sectionTitle={ctx.lesson.section?.title}
        position={ctx.position}
        facts={[
          { label: "Questions", value: String(questionCount) },
          { label: "Pass mark", value: `${quiz.passPct}%` },
          {
            label: "Attempts",
            value:
              quiz.maxAttempts == null
                ? attemptsUsed > 0
                  ? `Unlimited · ${attemptsUsed} used`
                  : "Unlimited"
                : `${attemptsUsed} of ${quiz.maxAttempts} used`,
          },
          {
            label: "Time limit",
            value: quiz.timeLimitSec ? `${Math.round(quiz.timeLimitSec / 60)} min` : "None",
          },
        ]}
      />

      {quiz.instructions && (
        <p className="text-sm leading-relaxed text-muted-foreground">{quiz.instructions}</p>
      )}

      {quiz.attempts.some((a) => a.submittedAt) && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Your attempts</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="pb-2 font-semibold">Attempt</th>
                <th className="pb-2 font-semibold">Score</th>
                <th className="pb-2 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              {quiz.attempts
                .filter((a) => a.submittedAt)
                .slice(0, 8)
                .map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="py-2 tabular-nums">
                      {a.attemptNo}
                      {best && a.id === best.id && (
                        <span className="ml-2 text-xs font-semibold text-primary">best</span>
                      )}
                    </td>
                    <td className="py-2 tabular-nums">
                      {a.scorePoints}/{a.maxPoints}
                    </td>
                    <td className="py-2">
                      <Pill tone={a.passed ? "success" : "neutral"}>
                        {a.passed ? "Passed" : "Not passed"}
                      </Pill>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      <div>
        {attemptsLeft === 0 ? (
          <Pill tone="destructive">No attempts remaining</Pill>
        ) : (
          <StartQuizButton courseId={courseId} lessonId={lessonId} />
        )}
      </div>
    </div>
  );
}
