"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { ActionError, tenantActionClient } from "@/lib/safe-action";
import {
  attachLessonResourcesSchema,
  removeLessonResourceSchema,
  requestResourceUploadSchema,
} from "@/lib/validation/course";
import { finalizeUploadSchema } from "@/lib/validation/learning";
import { mediaKindForMime } from "@/lib/learning/uploads";
import {
  createMediaUpload,
  finalizeMediaUpload,
  isStorageConfigured,
  STORAGE_BUCKETS,
} from "@/lib/storage";

const editorClient = tenantActionClient(["owner", "admin", "instructor"]);

async function assertCourseInTenant(courseId: string, tenantId: string) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.tenantId !== tenantId) throw new ActionError("Course not found.");
  return course;
}

async function assertLessonInCourse(lessonId: string, courseId: string) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || lesson.courseId !== courseId) throw new ActionError("Lesson not found.");
  return lesson;
}

/** Presigns a direct-to-Supabase upload for a RESOURCE lesson attachment. */
export const requestResourceUpload = editorClient
  .inputSchema(requestResourceUploadSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    if (!isStorageConfigured()) {
      throw new ActionError("File uploads aren't available right now.");
    }
    const presign = await createMediaUpload({
      tenantId: ctx.tenant.id,
      uploadedById: ctx.session.user.id,
      bucket: STORAGE_BUCKETS.uploads,
      filename: parsedInput.filename,
      mime: parsedInput.mime,
      sizeBytes: parsedInput.sizeBytes,
      kind: mediaKindForMime(parsedInput.mime),
    });
    return { assetId: presign.assetId, uploadUrl: presign.uploadUrl };
  });

/** Marks a resource upload READY after the browser PUT succeeds (owner-checked). */
export const finalizeResourceUpload = editorClient
  .inputSchema(finalizeUploadSchema)
  .action(async ({ parsedInput, ctx }) => {
    const asset = await db.mediaAsset.findUnique({
      where: { id: parsedInput.assetId },
      select: { uploadedById: true, bucket: true },
    });
    if (
      !asset ||
      asset.uploadedById !== ctx.session.user.id ||
      asset.bucket !== STORAGE_BUCKETS.uploads
    ) {
      throw new ActionError("Upload not found.");
    }
    await finalizeMediaUpload(parsedInput.assetId);
    return { ok: true };
  });

/** Attaches uploaded assets to a RESOURCE lesson (creator-owned tenant check). */
export const attachLessonResources = editorClient
  .inputSchema(attachLessonResourcesSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    await assertLessonInCourse(parsedInput.lessonId, parsedInput.courseId);

    const ids = [...new Set(parsedInput.resources.map((r) => r.assetId))];
    const assets = await db.mediaAsset.findMany({
      where: { id: { in: ids } },
      select: { id: true, uploadedById: true, bucket: true, status: true },
    });
    for (const id of ids) {
      const asset = assets.find((a) => a.id === id);
      if (
        !asset ||
        asset.uploadedById !== ctx.session.user.id ||
        asset.bucket !== STORAGE_BUCKETS.uploads
      ) {
        throw new ActionError("One of the attached files is invalid.");
      }
      if (asset.status !== "READY") {
        throw new ActionError("Finish uploading all files first.");
      }
    }

    await db.lessonResource.createMany({
      data: parsedInput.resources.map((r) => ({
        lessonId: parsedInput.lessonId,
        mediaAssetId: r.assetId,
        title: r.title,
      })),
    });
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return { ok: true };
  });

/** Removes an attachment from a RESOURCE lesson. */
export const removeLessonResource = editorClient
  .inputSchema(removeLessonResourceSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertCourseInTenant(parsedInput.courseId, ctx.tenant.id);
    const resource = await db.lessonResource.findUnique({
      where: { id: parsedInput.resourceId },
      select: { lesson: { select: { courseId: true } } },
    });
    if (!resource || resource.lesson.courseId !== parsedInput.courseId) {
      throw new ActionError("Attachment not found.");
    }
    await db.lessonResource.delete({ where: { id: parsedInput.resourceId } });
    revalidatePath(`/studio/${ctx.tenant.slug}/courses/${parsedInput.courseId}`);
    return { ok: true };
  });
