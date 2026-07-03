"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { issueCourseCredentialIfEarned } from "@/lib/credentials/issue";
import { drawQuizQuestions } from "@/lib/learning/quiz";
import { ActionError, authActionClient } from "@/lib/safe-action";

async function requireActiveEnrollment(userId: string, courseId: string) {
  const enrollment = await db.enrollment.findFirst({
    where: { userId, courseId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!enrollment) throw new ActionError("You're not enrolled in this course.");
  return enrollment;
}

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
  .inputSchema(
    z.object({
      courseId: z.string().min(1),
      lessonId: z.string().min(1),
      text: z.string().max(20000).optional(),
      repoUrl: z.url().optional().or(z.literal("")),
      url: z.url().optional().or(z.literal("")),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const enrollment = await requireActiveEnrollment(ctx.session.user.id, parsedInput.courseId);
    const assignment = await db.assignment.findUnique({
      where: { lessonId: parsedInput.lessonId },
    });
    if (!assignment) throw new ActionError("Assignment not found.");
    if (!parsedInput.text && !parsedInput.repoUrl && !parsedInput.url) {
      throw new ActionError("Add your work before submitting.");
    }

    const prior = await db.assignmentSubmission.count({
      where: { assignmentId: assignment.id, userId: ctx.session.user.id },
    });
    if (prior > 0 && !assignment.allowResubmission) {
      throw new ActionError("Resubmission isn't allowed for this assignment.");
    }

    await db.assignmentSubmission.create({
      data: {
        assignmentId: assignment.id,
        userId: ctx.session.user.id,
        enrollmentId: enrollment.id,
        attemptNo: prior + 1,
        text: parsedInput.text,
        repoUrl: parsedInput.repoUrl || null,
        url: parsedInput.url || null,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });

    revalidatePath(`/learn/courses/${parsedInput.courseId}`);
    return { ok: true };
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
    const orgId = submission.assignment.lesson!.course.tenant.organizationId;
    const membership = await db.member.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: ctx.session.user.id },
      },
    });
    const isAdmin = (ctx.session.user.role ?? "user") === "admin";
    if (!membership && !isAdmin) throw new ActionError("Not authorized to grade this.");

    await db.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        status: parsedInput.requestResubmission ? "RESUBMIT_REQUESTED" : "GRADED",
        scorePoints: parsedInput.scorePoints,
        feedback: parsedInput.feedback ? { text: parsedInput.feedback } : undefined,
        gradedById: ctx.session.user.id,
        gradedAt: new Date(),
      },
    });

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
    return { ok: true };
  });
