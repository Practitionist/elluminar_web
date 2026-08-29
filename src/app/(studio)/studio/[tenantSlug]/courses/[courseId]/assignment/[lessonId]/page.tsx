import Link from "next/link";
import { notFound } from "next/navigation";

import { requireStudioTenant } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tiptapToPlainText } from "@/lib/richtext";

import { AssignmentEditorForm } from "./assignment-editor-form";

export const metadata = { title: "Assignment editor" };

export default async function AssignmentEditorPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; courseId: string; lessonId: string }>;
}) {
  const { tenantSlug, courseId, lessonId } = await params;
  const { tenant } = await requireStudioTenant(tenantSlug, ["owner", "admin", "instructor"]);

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { assignment: true },
  });
  if (!lesson || lesson.courseId !== courseId) notFound();
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.tenantId !== tenant.id) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/studio/${tenantSlug}/courses/${courseId}`}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          ← Back to course
        </Link>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Assignment: {lesson.title}
        </h1>
      </div>
      <AssignmentEditorForm
        tenantSlug={tenantSlug}
        courseId={courseId}
        lessonId={lessonId}
        defaults={{
          title: lesson.assignment?.title ?? lesson.title,
          instructions: tiptapToPlainText(lesson.assignment?.instructions),
          gradingType: lesson.assignment?.gradingType ?? "MANUAL",
          maxPoints: lesson.assignment?.maxPoints ?? 100,
          submissionKinds: lesson.assignment?.submissionKinds ?? ["TEXT"],
          allowResubmission: lesson.assignment?.allowResubmission ?? true,
        }}
      />
    </div>
  );
}
