import "server-only";

import { db } from "@/lib/db";
import { issueProgramCredential } from "@/lib/credentials/issue";

/**
 * Rolls program progress up from the fanned-out enrollments/instances.
 * A program completes when every REQUIRED item is complete:
 *   COURSE item  → an adopted/created Enrollment with completedAt
 *   PROJECT item → a ProjectInstance (program-attributed) with status PASSED
 * Completion issues the co-branded PROGRAM credential (idempotent).
 */
export async function recomputeProgramProgress(programEnrollmentId: string) {
  const pe = await db.programEnrollment.findUnique({
    where: { id: programEnrollmentId },
    include: {
      programCohort: { include: { program: { include: { items: true } } } },
      enrollments: { select: { courseId: true, completedAt: true } },
      projectInstances: { select: { projectId: true, status: true } },
    },
  });
  if (!pe || pe.status === "DROPPED") return null;

  const required = pe.programCohort.program.items.filter((i) => i.required);
  if (required.length === 0) return null;

  const completedCourseIds = new Set(
    pe.enrollments.filter((e) => e.completedAt).map((e) => e.courseId),
  );
  const passedProjectIds = new Set(
    pe.projectInstances.filter((i) => i.status === "PASSED").map((i) => i.projectId),
  );

  const allDone = required.every((item) =>
    item.itemType === "COURSE"
      ? item.courseId != null && completedCourseIds.has(item.courseId)
      : item.projectId != null && passedProjectIds.has(item.projectId),
  );

  if (allDone && !pe.completedAt) {
    await db.programEnrollment.update({
      where: { id: pe.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await issueProgramCredential(pe.id);
    await db.xpEvent.create({
      data: {
        userId: pe.userId,
        kind: "PROGRAM_COMPLETED",
        points: 800,
        refType: "ProgramEnrollment",
        refId: pe.id,
      },
    });
    return { completed: true };
  }

  if (!allDone && pe.status === "ENROLLED") {
    await db.programEnrollment.update({
      where: { id: pe.id },
      data: { status: "IN_PROGRESS" },
    });
  }
  return { completed: allDone };
}

/** Rollup trigger for course completion: recompute any linked programs. */
export async function rollupCourseCompletion(enrollmentId: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { programEnrollmentId: true },
  });
  if (enrollment?.programEnrollmentId) {
    await recomputeProgramProgress(enrollment.programEnrollmentId).catch((err) =>
      console.error("[program rollup]", err),
    );
  }
}

/** Rollup trigger for project finalization. */
export async function rollupProjectCompletion(projectInstanceId: string) {
  const instance = await db.projectInstance.findUnique({
    where: { id: projectInstanceId },
    select: { programEnrollmentId: true },
  });
  if (instance?.programEnrollmentId) {
    await recomputeProgramProgress(instance.programEnrollmentId).catch((err) =>
      console.error("[program rollup]", err),
    );
  }
}
