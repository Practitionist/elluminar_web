"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { canGrade } from "@/lib/auth/roles";
import { issueCourseCredentialIfEarned } from "@/lib/credentials/issue";
import { drawQuizQuestions } from "@/lib/learning/quiz";
import { evaluateDeadline } from "@/lib/learning/deadline";
import { requireActiveEnrollment } from "@/lib/learning/enrollment";
import { isUniqueViolationOn } from "@/lib/prisma-error";
import { STORAGE_BUCKETS } from "@/lib/storage";
import { ActionError, authActionClient } from "@/lib/safe-action";
import { submitAssignmentSchema } from "@/lib/validation/learning";

/** Recomputes cached progress; completes the course + issues the certificate at 100%. */
async function refreshCourseProgress(enrollmentId: string) {
  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: {
      course: { select: { id: true, certificateEnabled: true, title: true, tenantId: true } },
    },
  });
  const [totalLessons, completed] = await Promise.all([
    db.lesson.count({ where: { courseId: enrollment.courseId } }),
    db.lessonProgress.count({ where: { enrollmentId, status: "COMPLETED" } }),
  ]);
  const pct = totalLessons === 0 ? 0 : Math.round((completed / totalLessons) * 100);
  const isComplete = totalLessons > 0 && completed >= totalLessons;

  await db.enrollment.update({
    where: { id: enrollmentId },
    data: {
      progressPct: pct,
      lastActivityAt: new Date(),
      ...(isComplete && !enrollment.completedAt
        ? { completedAt: new Date(), status: "COMPLETED" }
        : {}),
    },
  });

  if (isComplete && !enrollment.completedAt) {
    await issueCourseCredentialIfEarned(enrollmentId);
    await db.xpEvent.create({
      data: {
        userId: enrollment.userId,
        kind: "COURSE_COMPLETED",
        points: 200,
        refType: "Course",
        refId: enrollment.courseId,
      },
    });
    // Program rollup: a completed course may complete a program.
    const { rollupCourseCompletion } = await import(
      "@/lib/enterprise/program-progress"
    );
    await rollupCourseCompletion(enrollmentId);
  }
  return pct;
}

export const markLessonProgress = authActionClient
  .inputSchema(
    z.object({
      courseId: z.string().min(1),
      lessonId: z.string().min(1),
      status: z.enum(["IN_PROGRESS", "COMPLETED"]),
      secondsWatched: z.number().int().min(0).optional(),
      lastPositionSec: z.number().int().min(0).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const enrollment = await requireActiveEnrollment(ctx.session.user.id, parsedInput.courseId);
    const lesson = await db.lesson.findUnique({
      where: { id: parsedInput.lessonId },
      select: { type: true, courseId: true },
    });
    if (!lesson || lesson.courseId !== parsedInput.courseId) {
      throw new ActionError("Lesson not found.");
    }
    // QUIZ/ASSIGNMENT lessons complete only via their own flows (quiz pass /
    // instructor grading), never by self-marking — keeps progress honest.
    if (parsedInput.status === "COMPLETED" && (lesson.type === "QUIZ" || lesson.type === "ASSIGNMENT")) {
      throw new ActionError(
        lesson.type === "ASSIGNMENT"
          ? "This lesson completes when your instructor grades your submission."
          : "This lesson completes when you pass the quiz.",
      );
    }
    await db.lessonProgress.upsert({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: enrollment.id,
          lessonId: parsedInput.lessonId,
        },
      },
      update: {
        status: parsedInput.status,
        secondsWatched: parsedInput.secondsWatched,
        lastPositionSec: parsedInput.lastPositionSec,
        completedAt: parsedInput.status === "COMPLETED" ? new Date() : undefined,
      },
      create: {
        enrollmentId: enrollment.id,
        lessonId: parsedInput.lessonId,
        status: parsedInput.status,
        secondsWatched: parsedInput.secondsWatched ?? 0,
        lastPositionSec: parsedInput.lastPositionSec ?? 0,
        completedAt: parsedInput.status === "COMPLETED" ? new Date() : null,
      },
    });
    if (parsedInput.status === "COMPLETED") {
      await db.xpEvent.create({
        data: {
          userId: ctx.session.user.id,
          kind: "LESSON_COMPLETED",
          points: 10,
          refType: "Lesson",
          refId: parsedInput.lessonId,
        },
      });
    }
    const pct = await refreshCourseProgress(enrollment.id);
    revalidatePath(`/learn/courses/${parsedInput.courseId}`);
    return { progressPct: pct };
  });

/** Starts (or resumes) a quiz attempt with a seeded question draw. */
export const startQuizAttempt = authActionClient
  .inputSchema(z.object({ courseId: z.string().min(1), lessonId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const enrollment = await requireActiveEnrollment(ctx.session.user.id, parsedInput.courseId);
    const quiz = await db.quiz.findUnique({
      where: { lessonId: parsedInput.lessonId },
      include: { questions: { orderBy: { position: "asc" } } },
    });
    if (!quiz || quiz.questions.length === 0) throw new ActionError("Quiz has no questions.");

    const open = await db.quizAttempt.findFirst({
      where: { quizId: quiz.id, userId: ctx.session.user.id, submittedAt: null },
      orderBy: { attemptNo: "desc" },
    });
    if (open) return { attemptId: open.id };

    const attempts = await db.quizAttempt.count({
      where: { quizId: quiz.id, userId: ctx.session.user.id },
    });
    if (quiz.maxAttempts != null && attempts >= quiz.maxAttempts) {
      throw new ActionError("No attempts left for this quiz.");
    }

    const seed = Math.floor(Math.random() * 2 ** 31);
    const attempt = await db.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: ctx.session.user.id,
        enrollmentId: enrollment.id,
        attemptNo: attempts + 1,
        seed,
        maxPoints: 0, // set at submit from the drawn set
        dueAt: quiz.timeLimitSec
          ? new Date(Date.now() + quiz.timeLimitSec * 1000)
          : null,
      },
    });
    return { attemptId: attempt.id };
  });

/** Grades an attempt server-side against the drawn question set. */
export const submitQuizAttempt = authActionClient
  .inputSchema(
    z.object({
      attemptId: z.string().min(1),
      answers: z.record(
        z.string(),
        z.union([z.number(), z.array(z.number()), z.string()]),
      ),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const attempt = await db.quizAttempt.findUnique({
      where: { id: parsedInput.attemptId },
      include: { quiz: { include: { questions: { orderBy: { position: "asc" } } } } },
    });
    if (!attempt || attempt.userId !== ctx.session.user.id) {
      throw new ActionError("Attempt not found.");
    }
    if (attempt.submittedAt) throw new ActionError("Already submitted.");

    const drawn = drawQuizQuestions(attempt.quiz.questions, attempt.seed, attempt.quiz.drawCount);
    let score = 0;
    let maxPoints = 0;
    const results: Record<string, boolean> = {};

    for (const q of drawn) {
      maxPoints += q.points;
      const given = parsedInput.answers[q.id];
      const correct = q.correct as { index?: number; indexes?: number[]; text?: string };
      let ok = false;
      if (q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE") {
        ok = typeof given === "number" && given === correct.index;
      } else if (q.type === "MULTI_CHOICE") {
        const expected = [...(correct.indexes ?? [])].sort().join(",");
        const got = Array.isArray(given) ? [...given].sort().join(",") : "";
        ok = expected.length > 0 && expected === got;
      } else if (q.type === "SHORT_TEXT") {
        ok =
          typeof given === "string" &&
          given.trim().toLowerCase() === (correct.text ?? "").trim().toLowerCase();
      }
      if (ok) score += q.points;
      results[q.id] = ok;
    }

    const passed = maxPoints > 0 && (score / maxPoints) * 100 >= attempt.quiz.passPct;
    await db.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        submittedAt: new Date(),
        gradedAt: new Date(),
        answers: parsedInput.answers,
        scorePoints: score,
        maxPoints,
        passed,
      },
    });

    if (passed && attempt.quiz.lessonId && attempt.enrollmentId) {
      await db.lessonProgress.upsert({
        where: {
          enrollmentId_lessonId: {
            enrollmentId: attempt.enrollmentId,
            lessonId: attempt.quiz.lessonId,
          },
        },
        update: { status: "COMPLETED", completedAt: new Date() },
        create: {
          enrollmentId: attempt.enrollmentId,
          lessonId: attempt.quiz.lessonId,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
      await refreshCourseProgress(attempt.enrollmentId);
    }

    return { score, maxPoints, passed, results };
  });

export const submitAssignment = authActionClient
  .inputSchema(submitAssignmentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const enrollment = await requireActiveEnrollment(ctx.session.user.id, parsedInput.courseId);
    const assignment = await db.assignment.findUnique({
      where: { lessonId: parsedInput.lessonId },
      select: {
        id: true,
        maxPoints: true,
        dueOffsetDays: true,
        allowLate: true,
        allowResubmission: true,
        lesson: { select: { courseId: true } },
      },
    });
    // The lesson must belong to the course the learner is enrolled in —
    // otherwise a submission would link another course's assignment to this
    // enrollment (and land in the wrong tenant's grading queue).
    if (!assignment || assignment.lesson.courseId !== parsedInput.courseId) {
      throw new ActionError("Assignment not found.");
    }

    const text = parsedInput.text?.trim() || undefined;

    // Deadline enforcement: dueAt = enrollment.activatedAt + dueOffsetDays.
    const verdict = evaluateDeadline({
      activatedAt: enrollment.activatedAt,
      dueOffsetDays: assignment.dueOffsetDays,
      allowLate: assignment.allowLate,
    });
    if (verdict.action === "reject") {
      throw new ActionError(
        `The deadline passed ${verdict.dueAt.toLocaleDateString("en-IN", { dateStyle: "medium" })} and late submissions are disabled.`,
      );
    }

    const mediaAssetIds = [...new Set(parsedInput.mediaAssetIds ?? [])];
    const hasFiles = mediaAssetIds.length > 0;
    if (!text && !parsedInput.repoUrl && !parsedInput.url && !hasFiles) {
      throw new ActionError("Add your work before submitting.");
    }

    // Validate attached files before writing anything.
    if (hasFiles) {
      const assets = await db.mediaAsset.findMany({
        where: { id: { in: mediaAssetIds } },
        select: { id: true, uploadedById: true, bucket: true, status: true },
      });
      for (const id of mediaAssetIds) {
        const asset = assets.find((a) => a.id === id);
        if (
          !asset ||
          asset.uploadedById !== ctx.session.user.id ||
          asset.bucket !== STORAGE_BUCKETS.submissions
        ) {
          throw new ActionError("One of the attached files is invalid.");
        }
        if (asset.status !== "READY") {
          throw new ActionError("Finish uploading all files first.");
        }
      }
    }

    const prior = await db.assignmentSubmission.count({
      where: { assignmentId: assignment.id, userId: ctx.session.user.id },
    });
    if (prior > 0 && !assignment.allowResubmission) {
      throw new ActionError("Resubmission isn't allowed for this assignment.");
    }

    // Concurrent submits can race on @@unique([assignmentId, userId, attemptNo]).
    // With resubmission allowed, retry with the next slot; without it, the race
    // loser is a duplicate submit and must NOT sneak in as attempt #2.
    const maxTries = assignment.allowResubmission ? 3 : 1;
    let created = false;
    let attemptNo = prior + 1;
    for (let i = 0; i < maxTries && !created; i += 1) {
      try {
        await db.assignmentSubmission.create({
          data: {
            assignmentId: assignment.id,
            userId: ctx.session.user.id,
            enrollmentId: enrollment.id,
            attemptNo,
            text,
            repoUrl: parsedInput.repoUrl || null,
            url: parsedInput.url || null,
            status: "SUBMITTED",
            submittedAt: new Date(),
            late: verdict.action === "flag-late",
            ...(hasFiles
              ? { files: { create: mediaAssetIds.map((mediaAssetId) => ({ mediaAssetId })) } }
              : {}),
          },
        });
        created = true;
      } catch (err) {
        // Only recover from the attempt-number unique, never an unrelated index.
        // Prisma 7 + adapter-pg reports the columns under
        // meta.driverAdapterError, not meta.target — see @/lib/prisma-error.
        if (isUniqueViolationOn(err, "attemptNo")) {
          if (!assignment.allowResubmission) {
            throw new ActionError("You've already submitted this assignment.");
          }
          attemptNo += 1;
          continue;
        }
        throw err;
      }
    }
    if (!created) {
      throw new ActionError("Could not save your submission. Please try again.");
    }

    revalidatePath(`/learn/courses/${parsedInput.courseId}`);
    return { ok: true, late: verdict.action === "flag-late" };
  });

/** Instructor grading (studio side). */
export const gradeAssignmentSubmission = authActionClient
  .inputSchema(
    z.object({
      submissionId: z.string().min(1),
      scorePoints: z.number().int().min(0),
      feedback: z.string().max(10000).optional(),
      requestResubmission: z.boolean().default(false),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const submission = await db.assignmentSubmission.findUnique({
      where: { id: parsedInput.submissionId },
      include: {
        assignment: { include: { lesson: { include: { course: { include: { tenant: { include: { organization: true } } } } } } } },
      },
    });
    if (!submission) throw new ActionError("Submission not found.");
    // Authorize BEFORE any state/score validation — error text must not leak
    // submission status or assignment config to non-members guessing ids.
    const orgId = submission.assignment.lesson!.course.tenant.organizationId;
    const membership = await db.member.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: ctx.session.user.id },
      },
    });
    // Membership alone is not authority to grade: enterprise and university
    // learners hold a plain `member` row in the buying org (seat claim on
    // sign-in, SSO JIT provisioning), so the role check is what stops a learner
    // grading a peer. The studio route is already role-gated; this closes the
    // direct server-action call.
    if (
      !canGrade({
        membershipRole: membership?.role,
        isPlatformAdmin: (ctx.session.user.role ?? "user") === "admin",
      })
    ) {
      throw new ActionError("Not authorized to grade this.");
    }

    // Only pending work is gradeable; grading twice would double-complete.
    if (submission.status !== "SUBMITTED" && submission.status !== "RESUBMIT_REQUESTED") {
      throw new ActionError("This submission was already graded.");
    }
    if (parsedInput.scorePoints > submission.assignment.maxPoints) {
      throw new ActionError(
        `Score can't exceed ${submission.assignment.maxPoints} points for this assignment.`,
      );
    }

    // Conditional transition. Two graders can both read SUBMITTED; if one grades
    // while the other requests changes, an unconditional write can leave the row
    // RESUBMIT_REQUESTED with the lesson already COMPLETED — a credential issued
    // for work still marked as needing changes. Only the writer that actually
    // moved the row off a pending status runs the side effects below.
    const { count: transitioned } = await db.assignmentSubmission.updateMany({
      // Compare-and-swap on the status we actually read. Matching any pending
      // status is not enough: two graders can both read SUBMITTED, and if one
      // requests changes first, the other's decision — made against the stale
      // SUBMITTED — would still land and complete the lesson.
      where: { id: submission.id, status: submission.status },
      data: {
        status: parsedInput.requestResubmission ? "RESUBMIT_REQUESTED" : "GRADED",
        scorePoints: parsedInput.scorePoints,
        feedback: parsedInput.feedback ? { text: parsedInput.feedback } : undefined,
        gradedById: ctx.session.user.id,
        gradedAt: new Date(),
      },
    });
    if (transitioned === 0) throw new ActionError("This submission was already graded.");

    if (!parsedInput.requestResubmission) {
      await db.lessonProgress.upsert({
        where: {
          enrollmentId_lessonId: {
            enrollmentId: submission.enrollmentId,
            lessonId: submission.assignment.lessonId,
          },
        },
        update: { status: "COMPLETED", completedAt: new Date() },
        create: {
          enrollmentId: submission.enrollmentId,
          lessonId: submission.assignment.lessonId,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
      await refreshCourseProgress(submission.enrollmentId);
    }

    await db.notification.create({
      data: {
        userId: submission.userId,
        category: "grading",
        title: parsedInput.requestResubmission
          ? "Changes requested on your assignment"
          : "Your assignment was graded",
        body: parsedInput.feedback?.slice(0, 200),
        actionUrl: `/learn/courses/${submission.assignment.lesson!.courseId}`,
      },
    });
    return { ok: true, resubmission: parsedInput.requestResubmission };
  });
