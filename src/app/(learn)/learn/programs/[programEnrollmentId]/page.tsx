import { Check, ChevronLeft, GraduationCap, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pill, type PillTone } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { resolveUnlockedItems } from "@/lib/enterprise/unlock";
import { tiptapToPlainText } from "@/lib/richtext";
import { cn } from "@/lib/utils";

export const metadata = { title: "Program" };

const PROGRAM_STATUS_TONE: Record<string, PillTone> = {
  ENROLLED: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  DROPPED: "destructive",
};

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
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <Link
            href="/learn/programs"
            className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            My programs
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
              {program.title}
            </h1>
            <Pill tone={PROGRAM_STATUS_TONE[pe.status] ?? "neutral"}>
              {pe.status.toLowerCase().replace("_", " ")}
            </Pill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {program.ownerTenant.displayName} · {pe.programCohort.name}
          </p>
          {tiptapToPlainText(program.description) && (
            <p className="mt-3 text-sm">{tiptapToPlainText(program.description)}</p>
          )}
          {pe.credentials[0] && (
            <Link
              href={`/verify/${pe.credentials[0].verificationCode}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
            >
              <GraduationCap className="size-4" />
              Certificate: {pe.credentials[0].verificationCode}
            </Link>
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
              <div
                key={item.id}
                className={cn(
                  "rounded-2xl border border-border bg-card p-5",
                  !isUnlocked && "opacity-60",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-base font-extrabold">
                    <span
                      className={cn(
                        "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                        isComplete
                          ? "bg-success text-success-foreground"
                          : isUnlocked
                            ? "border-2 border-current text-muted-foreground opacity-30"
                            : "text-muted-foreground/40",
                      )}
                    >
                      {isComplete ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : !isUnlocked ? (
                        <Lock className="size-2.5" />
                      ) : null}
                    </span>
                    {i + 1}.{" "}
                    {item.itemType === "COURSE" ? item.course?.title : item.project?.title}
                  </span>
                  <span className="flex gap-2">
                    <Pill tone="primary">{item.itemType.toLowerCase()}</Pill>
                    {!item.required && <Pill tone="neutral">optional</Pill>}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
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
                        className="rounded-full"
                        variant={isComplete ? "outline" : "default"}
                      >
                        {isComplete ? "Review" : enrollment ? "Continue" : "Start"}
                      </Button>
                    ) : instance ? (
                      <Button
                        render={<Link href={`/learn/projects/${instance.id}`} />}
                        size="sm"
                        className="rounded-full"
                        variant={isComplete ? "outline" : "default"}
                      >
                        {isComplete ? "View" : "Open workspace"}
                      </Button>
                    ) : null)}
                  {!isUnlocked && (
                    <span className="text-xs font-semibold text-muted-foreground">
                      Unlocks after the previous item
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
