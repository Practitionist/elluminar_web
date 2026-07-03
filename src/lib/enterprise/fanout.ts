import "server-only";

import { db } from "@/lib/db";

/**
 * Program fan-out: a ProgramEnrollment materializes into course Enrollments
 * and ProjectInstances per ProgramItem. Idempotent and re-runnable — adding
 * items to a program later and resyncing creates only the delta.
 *
 * ADOPT-DON'T-DUPLICATE (top flagged risk): if the learner already has a
 * usable enrollment for an item (ACTIVE, expiry covers the program window,
 * not claimed by another program), we link it via programEnrollmentId ONLY —
 * never touching its source, expiry, or progress. A lifetime purchase must
 * never gain an expiresAt from a program. Rows that can't serve the window
 * (expired trials, short subscriptions) are left alone and the program gets
 * its own PROGRAM-sourced row instead — the Enrollment unique's nullable
 * cohortId is nulls-distinct, so the two coexist.
 */
export async function enrollUserInProgramCohort(input: {
  programCohortId: string;
  userId: string;
  licenseSeatId?: string;
}) {
  const cohort = await db.programCohort.findUniqueOrThrow({
    where: { id: input.programCohortId },
    include: { program: true },
  });

  const existing = await db.programEnrollment.findUnique({
    where: {
      programCohortId_userId: {
        programCohortId: input.programCohortId,
        userId: input.userId,
      },
    },
  });
  const programEnrollment =
    existing ??
    (await db.programEnrollment.create({
      data: {
        programCohortId: input.programCohortId,
        userId: input.userId,
        licenseSeatId: input.licenseSeatId,
        status: "ENROLLED",
      },
    }));

  await syncProgramFanout(programEnrollment.id);
  void cohort;
  return programEnrollment;
}

export async function syncProgramFanout(programEnrollmentId: string) {
  const pe = await db.programEnrollment.findUniqueOrThrow({
    where: { id: programEnrollmentId },
    include: {
      programCohort: {
        include: {
          program: { include: { items: { orderBy: { position: "asc" } } } },
        },
      },
      licenseSeat: { include: { license: true } },
    },
  });

  const expiresAt =
    pe.licenseSeat?.license.endsAt ?? pe.programCohort.endsAt ?? null;
  // Tie created rows to the granting license so seat revocation, early
  // license cancellation, and the expiry cron find exactly these rows.
  const orgLicenseId = pe.licenseSeat?.licenseId ?? null;

  let created = 0;
  for (const item of pe.programCohort.program.items) {
    if (item.itemType === "COURSE" && item.courseId) {
      // Already attributed to this program enrollment → done. (Also means a
      // row the license-expiry cron expired is never resurrected by a resync.)
      const attributed = await db.enrollment.findFirst({
        where: {
          userId: pe.userId,
          courseId: item.courseId,
          cohortId: null,
          programEnrollmentId: pe.id,
        },
      });
      if (attributed) continue;

      // Adopt: attribute a personal enrollment WITHOUT touching its
      // source/expiry — but only if it can serve the whole program window
      // and no other program has claimed it.
      const adoptable = await db.enrollment.findFirst({
        where: {
          userId: pe.userId,
          courseId: item.courseId,
          cohortId: null,
          programEnrollmentId: null,
          status: "ACTIVE",
          ...(expiresAt
            ? { OR: [{ expiresAt: null }, { expiresAt: { gte: expiresAt } }] }
            : { expiresAt: null }),
        },
        orderBy: { createdAt: "asc" },
      });
      if (adoptable) {
        await db.enrollment.update({
          where: { id: adoptable.id },
          data: { programEnrollmentId: pe.id },
        });
      } else {
        // find-then-create: the Enrollment unique has a nullable cohortId
        // (nulls-distinct), same precedent as commerce fulfillment.
        await db.enrollment.create({
          data: {
            userId: pe.userId,
            courseId: item.courseId,
            source: "PROGRAM",
            programEnrollmentId: pe.id,
            orgLicenseId,
            expiresAt,
          },
        });
        created += 1;
      }
    }

    if (item.itemType === "PROJECT" && item.projectId) {
      const existing = await db.projectInstance.findFirst({
        where: {
          userId: pe.userId,
          projectId: item.projectId,
          programEnrollmentId: pe.id,
        },
      });
      if (!existing) {
        // A personal purchase of the same project stays separate — program
        // capstones are reviewed within the program context.
        await db.projectInstance.create({
          data: {
            projectId: item.projectId,
            userId: pe.userId,
            source: "PROGRAM",
            programEnrollmentId: pe.id,
            requestedMentorLevel: null,
          },
        });
        created += 1;
      }
    }
  }

  if (pe.status === "ENROLLED" && created > 0) {
    await db.programEnrollment.update({
      where: { id: pe.id },
      data: { status: "IN_PROGRESS" },
    });
  }
  return { created };
}
