import Link from "next/link";
import { notFound } from "next/navigation";

import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { QuizEditor } from "./quiz-editor";

export const metadata = { title: "Quiz editor" };

export default async function QuizEditorPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; courseId: string; lessonId: string }>;
}) {
  const { tenantSlug, courseId, lessonId } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin", "instructor"]);

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { quiz: { include: { questions: { orderBy: { position: "asc" } } } } },
  });
  if (!lesson || lesson.courseId !== courseId) notFound();
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.tenantId !== tenant.id) notFound();

  const quiz =
    lesson.quiz ??
    (await db.quiz.create({
      data: { lessonId, title: lesson.title },
      include: { questions: true },
    }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/studio/${tenantSlug}/courses/${courseId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to course
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Quiz: {lesson.title}
        </h1>
      </div>
      <QuizEditor
        tenantSlug={tenantSlug}
        courseId={courseId}
        lessonId={lessonId}
        quiz={{
          id: quiz.id,
          title: quiz.title,
          passPct: quiz.passPct,
          maxAttempts: quiz.maxAttempts,
          timeLimitSec: quiz.timeLimitSec,
          drawCount: quiz.drawCount,
          shuffleQuestions: quiz.shuffleQuestions,
          showAnswers: quiz.showAnswers,
          questions: quiz.questions.map((q) => ({
            id: q.id,
            type: q.type,
            prompt: (q.prompt as { text?: string })?.text ?? "",
            options: ((q.options as { choices?: string[] })?.choices ?? []) as string[],
            correct: q.correct as { index?: number; indexes?: number[]; text?: string },
            points: q.points,
            explanation: q.explanation ?? "",
            poolTag: q.poolTag ?? "",
          })),
        }}
      />
    </div>
  );
}
