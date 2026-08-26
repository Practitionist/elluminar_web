"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { ActionError, authActionClient } from "@/lib/safe-action";
import {
  createMediaUpload,
  finalizeMediaUpload,
  isStorageConfigured,
  STORAGE_BUCKETS,
} from "@/lib/storage";
import { mediaKindForMime } from "@/lib/learning/uploads";
import {
  finalizeSubmissionUploadSchema,
  requestSubmissionUploadSchema,
} from "@/lib/validation/learning";

async function requireActiveEnrollment(userId: string, courseId: string) {
  const enrollment = await db.enrollment.findFirst({
    where: { userId, courseId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!enrollment) throw new ActionError("You're not enrolled in this course.");
  return enrollment;
}

/** Presigns a direct-to-Supabase upload for an assignment file submission. */
export const requestSubmissionUpload = authActionClient
  .inputSchema(requestSubmissionUploadSchema)
  .action(async ({ parsedInput, ctx }) => {
    await requireActiveEnrollment(ctx.session.user.id, parsedInput.courseId);
    const assignment = await db.assignment.findUnique({
      where: { lessonId: parsedInput.lessonId },
      include: {
        lesson: { select: { course: { select: { tenantId: true } } } },
      },
    });
    if (!assignment) throw new ActionError("Assignment not found.");
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
      select: { uploadedById: true, bucket: true },
    });
    if (
      !asset ||
      asset.uploadedById !== ctx.session.user.id ||
      asset.bucket !== STORAGE_BUCKETS.submissions
    ) {
      throw new ActionError("Upload not found.");
    }
    await finalizeMediaUpload(parsedInput.assetId);
    revalidatePath("/learn");
    return { ok: true };
  });
