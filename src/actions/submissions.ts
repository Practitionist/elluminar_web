"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { ActionError, authActionClient } from "@/lib/safe-action";
import {
  createMediaUpload,
  finalizeMediaUpload,
  isStorageConfigured,
  objectExists,
  STORAGE_BUCKETS,
} from "@/lib/storage";
import { requireActiveEnrollment } from "@/lib/learning/enrollment";
import { mediaKindForMime } from "@/lib/learning/uploads";
import {
  finalizeSubmissionUploadSchema,
  requestSubmissionUploadSchema,
} from "@/lib/validation/learning";

/** Presigns a direct-to-Supabase upload for an assignment file submission. */
export const requestSubmissionUpload = authActionClient
  .inputSchema(requestSubmissionUploadSchema)
  .action(async ({ parsedInput, ctx }) => {
    await requireActiveEnrollment(ctx.session.user.id, parsedInput.courseId);
    const assignment = await db.assignment.findUnique({
      where: { lessonId: parsedInput.lessonId },
      include: {
        lesson: { select: { courseId: true, course: { select: { tenantId: true } } } },
      },
    });
    // The lesson must belong to the course the learner is enrolled in. Without
    // this, being enrolled anywhere presigns against any other tenant's
    // assignment — stamping the MediaAsset with that tenant's id, and turning
    // the distinct errors here into a cross-tenant probe for which lessons are
    // FILE-accepting assignments. Mirrors the check in submitAssignment.
    if (!assignment || assignment.lesson.courseId !== parsedInput.courseId) {
      throw new ActionError("Assignment not found.");
    }
    if (!assignment.submissionKinds.includes("FILE")) {
      throw new ActionError("This assignment doesn't accept file uploads.");
    }
    if (!isStorageConfigured()) {
      throw new ActionError("File uploads aren't available right now.");
    }

    const presign = await createMediaUpload({
      tenantId: assignment.lesson.course.tenantId ?? undefined,
      uploadedById: ctx.session.user.id,
      bucket: STORAGE_BUCKETS.submissions,
      filename: parsedInput.filename,
      mime: parsedInput.mime,
      sizeBytes: parsedInput.sizeBytes,
      kind: mediaKindForMime(parsedInput.mime),
    });
    return { assetId: presign.assetId, uploadUrl: presign.uploadUrl };
  });

/** Marks a submission upload READY after the browser PUT succeeds (owner-checked). */
export const finalizeSubmissionUpload = authActionClient
  .inputSchema(finalizeSubmissionUploadSchema)
  .action(async ({ parsedInput, ctx }) => {
    const asset = await db.mediaAsset.findUnique({
      where: { id: parsedInput.assetId },
      select: { uploadedById: true, bucket: true, path: true, status: true },
    });
    if (
      !asset ||
      asset.uploadedById !== ctx.session.user.id ||
      asset.bucket !== STORAGE_BUCKETS.submissions
    ) {
      throw new ActionError("Upload not found.");
    }
    // The PUT must have actually landed — READY without an object would let a
    // submission through whose download later 404s.
    if (asset.status !== "READY") {
      if (!asset.path || !(await objectExists(asset.bucket, asset.path))) {
        throw new ActionError("Upload didn't complete — try attaching the file again.");
      }
      await finalizeMediaUpload(parsedInput.assetId);
    }
    revalidatePath("/learn");
    return { ok: true };
  });
