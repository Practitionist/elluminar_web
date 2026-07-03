import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { resolveUnlockedItems } from "@/lib/enterprise/unlock";
import { tiptapToPlainText } from "@/lib/richtext";

export const metadata = { title: "Program" };

export default async function LearnerProgramPage({
  params,
}: {
  params: Promise<{ programEnrollmentId: string }>;
}) {
  const { programEnrollmentId } = await params;
  const session = await requireUser(`/learn/programs/${programEnrollmentId}`);

  const pe = await db.programEnrollment.findUnique({
    where: { id: programEnrollmentId },
    include: {
      programCohort: {
        include: {
          program: {
            include: {
              ownerTenant: { select: { displayName: true } },
              items: {
                orderBy: { position: "asc" },
                include: {
                  course: { select: { id: true, title: true } },
                  project: { select: { id: true, title: true, tier: true } },
                },
              },
            },
          },
        },
      },
      enrollments: { select: { courseId: true, completedAt: true, progressPct: true } },
      projectInstances: { select: { id: true, projectId: true, status: true } },
      credentials: { select: { verificationCode: true } },
    },
  });
  if (!pe || pe.userId !== session.user.id) notFound();

  const program = pe.programCohort.program;
  const completedItemIds = new Set(
    program.items
      .filter((item) =>
        item.itemType === "COURSE"
          ? pe.enrollments.some((e) => e.courseId === item.courseId && e.completedAt)
          : pe.projectInstances.some(
              (i) => i.projectId === item.projectId && i.status === "PASSED",
            ),
      )
      .map((i) => i.id),
  );
  const unlocked = resolveUnlockedItems(program.items, completedItemIds);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/learn/programs" className="text-sm text-muted-foreground hover:text-foreground">
          ← My programs
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{program.title}</h1>
          <Badge variant={pe.status === "COMPLETED" ? "default" : "outline"}>
            {pe.status.toLowerCase().replace("_", " ")}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {program.ownerTenant.displayName} · {pe.programCohort.name}
        </p>
        {tiptapToPlainText(program.description) && (
          <p className="mt-3 text-sm">{tiptapToPlainText(program.description)}</p>
        )}
        {pe.credentials[0] && (
          <p className="mt-2 text-sm">
            🎓 Certificate:{" "}
            <Link
              href={`/verify/${pe.credentials[0].verificationCode}`}
              className="font-medium underline"
            >
              {pe.credentials[0].verificationCode}
            </Link>
          </p>
        )}
      </div>

      <div className="space-y-3">
        {program.items.map((item, i) => {
          const isUnlocked = unlocked.has(item.id);
          const isComplete = completedItemIds.has(item.id);
          const enrollment =
            item.itemType === "COURSE"
              ? pe.enrollments.find((e) => e.courseId === item.courseId)
              : null;
          const instance =
            item.itemType === "PROJECT"
              ? pe.projectInstances.find((x) => x.projectId === item.projectId)
              : null;

          return (
            <Card key={item.id} className={!isUnlocked ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {isComplete ? "✓" : isUnlocked ? "○" : "🔒"}
                    </span>
                    {i + 1}.{" "}
                    {item.itemType === "COURSE" ? item.course?.title : item.project?.title}
                  </span>
                  <span className="flex gap-2">
                    <Badge variant="outline">{item.itemType.toLowerCase()}</Badge>
                    {!item.required && <Badge variant="secondary">optional</Badge>}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.itemType === "COURSE"
                    ? enrollment
                      ? `${Math.round(enrollment.progressPct)}% complete`
                      : "Not started"
                    : instance
                      ? instance.status.toLowerCase().replace(/_/g, " ")
                      : "Not started"}
                </span>
                {isUnlocked &&
                  (item.itemType === "COURSE" && item.course ? (
                    <Button
                      render={<Link href={`/learn/courses/${item.course.id}`} />}
                      size="sm"
                      variant={isComplete ? "outline" : "default"}
                    >
                      {isComplete ? "Review" : enrollment ? "Continue" : "Start"}
                    </Button>
                  ) : instance ? (
                    <Button
                      render={<Link href={`/learn/projects/${instance.id}`} />}
                      size="sm"
                      variant={isComplete ? "outline" : "default"}
                    >
                      {isComplete ? "View" : "Open workspace"}
                    </Button>
                  ) : null)}
                {!isUnlocked && (
                  <span className="text-xs text-muted-foreground">
                    Unlocks after the previous item
                  </span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
