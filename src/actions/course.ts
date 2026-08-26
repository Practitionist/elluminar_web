"use server";

import { revalidatePath } from "next/cache";

import { env } from "@/env";
import { db } from "@/lib/db";
import { isFermionConfigured } from "@/lib/fermion/client";
import { createVideoUpload, markUploadedAndProcess } from "@/lib/fermion/video";
import { ActionError, adminActionClient, tenantActionClient } from "@/lib/safe-action";
import {
  confirmLessonVideoUploadSchema,
  createCourseSchema,
  deleteEntitySchema,
  deleteQuizQuestionSchema,
  reorderSchema,
  requestLessonVideoUploadSchema,
  reviewCourseSchema,
  setCoursePriceSchema,
  submitCourseForReviewSchema,
  updateCourseSettingsSchema,
  upsertAssignmentSchema,
  upsertCohortSchema,
  upsertLessonSchema,
  upsertQuizQuestionSchema,
  upsertQuizSchema,
  upsertSectionSchema,
} from "@/lib/validation/course";

const editorClient = tenantActionClient(["owner", "admin", "instructor"]);

async function assertCourseInTenant(courseId: string, tenantId: string) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.tenantId !== tenantId) throw new ActionError("Course not found.");
  return course;
}

const paise = (rupees: number) => BigInt(Math.round(rupees * 100));

export const createCourse = editorClient
  .inputSchema(createCourseSchema)
  .action(async ({ parsedInput, ctx }) => {
    const dup = await db.course.findUnique({
      where: { tenantId_slug: { tenantId: ctx.tenant.id, slug: parsedInput.slug } },
    });
    if (dup) throw new ActionError("A course with that slug already exists.");
    const course = await db.course.create({
      data: {
        tenantId: ctx.tenant.id,
        createdById: ctx.session.user.id,
        title: parsedInput.title,
        slug: parsedInput.slug,
        subtitle: parsedInput.subtitle,
        level: parsedInput.level,
        categoryId: parsedInput.categoryId || null,
        sections: { create: [{ title: "Getting started", position: 0 }] },
      },
    });
    revalidatePath(`/studio/${ctx.tenant.slug}/courses`);
    return { courseId: course.id };
  });

export const updateCourseSettings = editorClient
  .inputSchema(updateCourseSettingsSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    await db.course.update({
      where: { id: parsedInput.courseId },
      data: {
        title: parsedInput.title,
        subtitle: parsedInput.subtitle,
        description: parsedInput.description ?? undefined,
        level: parsedInput.level,
        categoryId: parsedInput.categoryId || null,
        tags: parsedInput.tags,
        outcomes: parsedInput.outcomes,
        prerequisites: parsedInput.prerequisites,
        language: parsedInput.language,
        visibility: parsedInput.visibility,
        selfPacedEnabled: parsedInput.selfPacedEnabled,
        liveEnabled: parsedInput.liveEnabled,
        estimatedHours: parsedInput.estimatedHours ?? null,
        certificateEnabled: parsedInput.certificateEnabled,
      },
    });
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    revalidatePath(`/c/${ctx.tenant.slug}`);
    return { ok: true };
  });

export const upsertSection = editorClient
  .inputSchema(upsertSectionSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    if (parsedInput.sectionId) {
      await db.courseSection.update({
        where: { id: parsedInput.sectionId },
        data: { title: parsedInput.title, description: parsedInput.description },
      });
    } else {
      const last = await db.courseSection.findFirst({
        where: { courseId: parsedInput.courseId },
        orderBy: { position: "desc" },
      });
      await db.courseSection.create({
        data: {
          courseId: parsedInput.courseId,
          title: parsedInput.title,
          description: parsedInput.description,
          position: (last?.position ?? -1) + 1,
        },
      });
    }
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return { ok: true };
  });

export const upsertLesson = editorClient
  .inputSchema(upsertLessonSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);

    // Ownership: the lesson (when editing) must belong to THIS course — a raw
    // id from another tenant must never be writable here.
    const existingLesson = parsedInput.lessonId
      ? await db.lesson.findFirst({
          where: { id: parsedInput.lessonId, courseId: parsedInput.courseId },
        })
      : null;
    if (parsedInput.lessonId && !existingLesson) {
      throw new ActionError("Lesson not found.");
    }

    // Dev/testing escape hatch: an external video URL creates an EXTERNAL
    // VideoAsset — reusing the lesson's existing EXTERNAL asset on re-save so
    // edits never orphan rows or clobber a linked Fermion asset.
    let videoAssetId = parsedInput.videoAssetId ?? undefined;
    if (!videoAssetId && parsedInput.type === "VIDEO" && parsedInput.externalVideoUrl) {
      const current = existingLesson?.videoAssetId
        ? await db.videoAsset.findUnique({ where: { id: existingLesson.videoAssetId } })
        : null;
      if (current?.provider === "EXTERNAL") {
        await db.videoAsset.update({
          where: { id: current.id },
          data: { playbackMeta: { url: parsedInput.externalVideoUrl } },
        });
        videoAssetId = current.id;
      } else {
        const asset = await db.videoAsset.create({
          data: {
            tenantId: ctx.tenant.id,
            provider: "EXTERNAL",
            status: "READY",
            title: parsedInput.title,
            drmEnabled: false,
            playbackMeta: { url: parsedInput.externalVideoUrl },
            uploadedById: ctx.session.user.id,
          },
        });
        videoAssetId = asset.id;
      }
    }

    const data = {
      type: parsedInput.type,
      title: parsedInput.title,
      isFreePreview: parsedInput.isFreePreview,
      releaseAfterDays: parsedInput.releaseAfterDays ?? null,
      durationSec: parsedInput.durationSec ?? null,
      content: parsedInput.content ?? undefined,
      labConfig: parsedInput.labConfig ?? undefined,
    };
    // Only touch videoAssetId when explicitly provided — editing any other
    // field must never detach an already-linked video asset.
    const updateData = {
      ...data,
      ...(videoAssetId !== undefined ? { videoAssetId } : {}),
    };

    let lessonId = existingLesson?.id;
    if (lessonId) {
      await db.lesson.update({ where: { id: lessonId }, data: updateData });
    } else {
      // The section FK alone wouldn't stop a lesson landing in another
      // course's section — require the section to belong to THIS course.
      const section = await db.courseSection.findFirst({
        where: { id: parsedInput.sectionId, courseId: parsedInput.courseId },
      });
      if (!section) throw new ActionError("Section not found in this course.");
      const last = await db.lesson.findFirst({
        where: { sectionId: parsedInput.sectionId },
        orderBy: { position: "desc" },
      });
      const lesson = await db.lesson.create({
        data: {
          ...updateData,
          videoAssetId: videoAssetId ?? null,
          sectionId: parsedInput.sectionId,
          courseId: parsedInput.courseId,
          position: (last?.position ?? -1) + 1,
        },
      });
      lessonId = lesson.id;
      if (parsedInput.type === "QUIZ") {
        await db.quiz.create({
          data: { lessonId, title: parsedInput.title },
        });
      }
      if (parsedInput.type === "ASSIGNMENT") {
        await db.assignment.create({
          data: {
            lessonId,
            title: parsedInput.title,
            instructions: { type: "doc", content: [] },
          },
        });
      }
    }
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return { lessonId };
  });

export const reorderEntity = editorClient
  .inputSchema(reorderSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    if (parsedInput.kind === "SECTION") {
      const section = await db.courseSection.findFirst({
        where: { id: parsedInput.id, courseId: parsedInput.courseId },
      });
      if (!section) throw new ActionError("Section not found.");
      const neighbor = await db.courseSection.findFirst({
        where: {
          courseId: section.courseId,
          position:
            parsedInput.direction === "UP"
              ? { lt: section.position }
              : { gt: section.position },
        },
        orderBy: { position: parsedInput.direction === "UP" ? "desc" : "asc" },
      });
      if (neighbor) {
        await db.$transaction([
          db.courseSection.update({
            where: { id: section.id },
            data: { position: neighbor.position },
          }),
          db.courseSection.update({
            where: { id: neighbor.id },
            data: { position: section.position },
          }),
        ]);
      }
    } else {
      const lesson = await db.lesson.findFirst({
        where: { id: parsedInput.id, courseId: parsedInput.courseId },
      });
      if (!lesson) throw new ActionError("Lesson not found.");
      const neighbor = await db.lesson.findFirst({
        where: {
          sectionId: lesson.sectionId,
          position:
            parsedInput.direction === "UP"
              ? { lt: lesson.position }
              : { gt: lesson.position },
        },
        orderBy: { position: parsedInput.direction === "UP" ? "desc" : "asc" },
      });
      if (neighbor) {
        await db.$transaction([
          db.lesson.update({ where: { id: lesson.id }, data: { position: neighbor.position } }),
          db.lesson.update({ where: { id: neighbor.id }, data: { position: lesson.position } }),
        ]);
      }
    }
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return { ok: true };
  });

export const deleteEntity = editorClient
  .inputSchema(deleteEntitySchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    if (parsedInput.kind === "SECTION") {
      const section = await db.courseSection.findFirst({
        where: { id: parsedInput.id, courseId: parsedInput.courseId },
      });
      if (!section) throw new ActionError("Section not found.");
      await db.courseSection.delete({ where: { id: section.id } });
    } else {
      const lesson = await db.lesson.findFirst({
        where: { id: parsedInput.id, courseId: parsedInput.courseId },
      });
      if (!lesson) throw new ActionError("Lesson not found.");
      await db.lesson.delete({ where: { id: lesson.id } });
    }
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return { ok: true };
  });

export const setCoursePrice = editorClient
  .inputSchema(setCoursePriceSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    const existing = await db.price.findFirst({
      where: { courseId: parsedInput.courseId, currency: "INR", region: null },
    });
    const data = {
      amountMinor: paise(parsedInput.amountRupees),
      compareAtMinor:
        parsedInput.compareAtRupees != null ? paise(parsedInput.compareAtRupees) : null,
      active: true,
    };
    if (existing) {
      await db.price.update({ where: { id: existing.id }, data });
    } else {
      await db.price.create({
        data: {
          itemType: "COURSE",
          courseId: parsedInput.courseId,
          currency: "INR",
          ...data,
        },
      });
    }
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return { ok: true };
  });

export const upsertCohort = editorClient
  .inputSchema(upsertCohortSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    const data = {
      name: parsedInput.name,
      slug: parsedInput.slug,
      startsAt: parsedInput.startsAt,
      endsAt: parsedInput.endsAt ?? null,
      enrollmentClosesAt: parsedInput.enrollmentClosesAt ?? null,
      capacity: parsedInput.capacity ?? null,
      status: "OPEN" as const,
    };
    let cohortId = parsedInput.cohortId;
    if (cohortId) {
      await db.cohort.update({ where: { id: cohortId }, data });
    } else {
      const cohort = await db.cohort.create({
        data: { ...data, courseId: parsedInput.courseId },
      });
      cohortId = cohort.id;
    }
    if (parsedInput.seatPriceRupees != null) {
      const existing = await db.price.findFirst({
        where: { cohortId, currency: "INR", region: null },
      });
      if (existing) {
        await db.price.update({
          where: { id: existing.id },
          data: { amountMinor: paise(parsedInput.seatPriceRupees), active: true },
        });
      } else {
        await db.price.create({
          data: {
            itemType: "COHORT_SEAT",
            cohortId,
            currency: "INR",
            amountMinor: paise(parsedInput.seatPriceRupees),
          },
        });
      }
    }
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return { cohortId };
  });

export const submitCourseForReview = editorClient
  .inputSchema(submitCourseForReviewSchema)
  .action(async ({ parsedInput, ctx }) => {
    const course = await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    if (ctx.tenant.status !== "APPROVED") {
      throw new ActionError("Your school must be approved before publishing.");
    }
    const [lessonCount, price] = await Promise.all([
      db.lesson.count({ where: { courseId: course.id } }),
      db.price.findFirst({ where: { courseId: course.id, active: true } }),
    ]);
    if (lessonCount === 0) throw new ActionError("Add at least one lesson first.");
    if (!price) throw new ActionError("Set a price first (₹0 is allowed for free courses).");

    await db.course.update({
      where: { id: course.id },
      data: { status: "IN_REVIEW" },
    });
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${course.id}`);
    return { ok: true };
  });

/** Platform moderation: publish or send back to draft. */
export const reviewCourse = adminActionClient
  .inputSchema(reviewCourseSchema)
  .action(async ({ parsedInput, ctx }) => {
    const course = await db.course.findUnique({ where: { id: parsedInput.courseId } });
    if (!course) throw new ActionError("Course not found.");
    await db.course.update({
      where: { id: course.id },
      data: {
        status: parsedInput.decision,
        publishedAt: parsedInput.decision === "PUBLISHED" ? new Date() : course.publishedAt,
      },
    });
    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "ADMIN",
        tenantId: course.tenantId,
        action: `course.review.${parsedInput.decision.toLowerCase()}`,
        entityType: "Course",
        entityId: course.id,
        after: { decision: parsedInput.decision, note: parsedInput.note },
      },
    });
    revalidatePath("/admin/moderation");
    return { ok: true };
  });

// ── Quiz & assignment authoring ─────────────────────────────────────

export const upsertQuiz = editorClient
  .inputSchema(upsertQuizSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    await db.quiz.upsert({
      where: { lessonId: parsedInput.lessonId },
      update: {
        title: parsedInput.title,
        passPct: parsedInput.passPct,
        maxAttempts: parsedInput.maxAttempts ?? null,
        timeLimitSec: parsedInput.timeLimitSec ?? null,
        drawCount: parsedInput.drawCount ?? null,
        shuffleQuestions: parsedInput.shuffleQuestions,
        showAnswers: parsedInput.showAnswers,
      },
      create: {
        lessonId: parsedInput.lessonId,
        title: parsedInput.title,
        passPct: parsedInput.passPct,
        maxAttempts: parsedInput.maxAttempts ?? null,
        timeLimitSec: parsedInput.timeLimitSec ?? null,
        drawCount: parsedInput.drawCount ?? null,
        shuffleQuestions: parsedInput.shuffleQuestions,
        showAnswers: parsedInput.showAnswers,
      },
    });
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return { ok: true };
  });

export const upsertQuizQuestion = editorClient
  .inputSchema(upsertQuizQuestionSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);

    if (parsedInput.type !== "SHORT_TEXT" && parsedInput.options.length < 2) {
      throw new ActionError("Choice questions need at least 2 options.");
    }
    if (parsedInput.type !== "SHORT_TEXT" && parsedInput.correctIndexes.length === 0) {
      throw new ActionError("Mark at least one correct option.");
    }

    const correct =
      parsedInput.type === "SHORT_TEXT"
        ? { text: parsedInput.correctText ?? "" }
        : parsedInput.type === "MULTI_CHOICE"
          ? { indexes: parsedInput.correctIndexes }
          : { index: parsedInput.correctIndexes[0] };

    const data = {
      type: parsedInput.type,
      prompt: { text: parsedInput.prompt },
      options:
        parsedInput.type === "SHORT_TEXT" ? undefined : { choices: parsedInput.options },
      correct,
      points: parsedInput.points,
      explanation: parsedInput.explanation,
      poolTag: parsedInput.poolTag || null,
    };

    if (parsedInput.questionId) {
      await db.quizQuestion.update({ where: { id: parsedInput.questionId }, data });
    } else {
      const last = await db.quizQuestion.findFirst({
        where: { quizId: parsedInput.quizId },
        orderBy: { position: "desc" },
      });
      await db.quizQuestion.create({
        data: { ...data, quizId: parsedInput.quizId, position: (last?.position ?? -1) + 1 },
      });
    }
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return { ok: true };
  });

export const deleteQuizQuestion = editorClient
  .inputSchema(deleteQuizQuestionSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    await db.quizQuestion.delete({ where: { id: parsedInput.questionId } });
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return { ok: true };
  });

// ── DRM video uploads (Fermion) ─────────────────────────────────────

/**
 * Mints a Fermion presigned upload URL. The VideoAsset is NOT linked to the
 * lesson yet — that happens in confirmLessonVideoUpload, so a failed browser
 * upload never strips the lesson's previous playable asset.
 */
export const requestLessonVideoUpload = editorClient
  .inputSchema(requestLessonVideoUploadSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    const lesson = await db.lesson.findFirst({
      where: { id: parsedInput.lessonId, courseId: parsedInput.courseId, type: "VIDEO" },
    });
    if (!lesson) throw new ActionError("Video lesson not found.");
    if (!isFermionConfigured()) {
      throw new ActionError(
        "Video uploads are not configured yet (missing FERMION_API_KEY). Use an external URL for now.",
      );
    }
    // Playback needs the whitelabel embed host too — reject early rather than
    // accepting an upload that could never play.
    if (!env.FERMION_SCHOOL_HOSTNAME) {
      throw new ActionError(
        "Video embeds are not configured (missing FERMION_SCHOOL_HOSTNAME).",
      );
    }

    const upload = await createVideoUpload({
      tenantId: ctx.tenant.id,
      uploadedById: ctx.session.user.id,
      filename: parsedInput.filename,
    });
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return upload;
  });

/** Marks the uploaded file as complete, starts transcoding, links the asset. */
export const confirmLessonVideoUpload = editorClient
  .inputSchema(confirmLessonVideoUploadSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    const [asset, lesson] = await Promise.all([
      db.videoAsset.findFirst({
        where: {
          id: parsedInput.videoAssetId,
          tenantId: ctx.tenant.id,
          provider: "FERMION",
        },
      }),
      db.lesson.findFirst({
        where: { id: parsedInput.lessonId, courseId: parsedInput.courseId },
      }),
    ]);
    if (!asset) throw new ActionError("Video asset not found.");
    if (!lesson) throw new ActionError("Video lesson not found.");

    const updated = await markUploadedAndProcess(asset.id);
    await db.lesson.update({
      where: { id: lesson.id },
      data: { videoAssetId: asset.id },
    });
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return { status: updated.status };
  });

export const upsertAssignment = editorClient
  .inputSchema(upsertAssignmentSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    const instructions = {
      type: "doc",
      content: parsedInput.instructions
        .split("\n")
        .filter(Boolean)
        .map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })),
    };
    await db.assignment.upsert({
      where: { lessonId: parsedInput.lessonId },
      update: {
        title: parsedInput.title,
        instructions,
        gradingType: parsedInput.gradingType,
        maxPoints: parsedInput.maxPoints,
        submissionKinds: parsedInput.submissionKinds,
        allowResubmission: parsedInput.allowResubmission,
      },
      create: {
        lessonId: parsedInput.lessonId,
        title: parsedInput.title,
        instructions,
        gradingType: parsedInput.gradingType,
        maxPoints: parsedInput.maxPoints,
        submissionKinds: parsedInput.submissionKinds,
        allowResubmission: parsedInput.allowResubmission,
      },
    });
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return { ok: true };
  });
