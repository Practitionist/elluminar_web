import { z } from "zod";

import {
  MAX_UPLOAD_BYTES,
  SUBMISSION_MIME_ALLOWLIST,
} from "@/lib/learning/uploads";

export const submitAssignmentSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  text: z.string().max(20000).optional(),
  repoUrl: z.url().optional().or(z.literal("")),
  url: z.url().optional().or(z.literal("")),
  mediaAssetIds: z.array(z.string().min(1)).max(5).optional(),
});

export const requestSubmissionUploadSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  filename: z.string().min(1).max(255),
  mime: z
    .string()
    .refine((m) => (SUBMISSION_MIME_ALLOWLIST as readonly string[]).includes(m), {
      message: "Allowed file types: PDF, PNG, JPG, WEBP or ZIP.",
    }),
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(MAX_UPLOAD_BYTES, { message: "Files must be 25 MB or smaller." }),
});

export const finalizeSubmissionUploadSchema = z.object({
  assetId: z.string().min(1),
});

/** Bucket-agnostic finalize input, shared by submission and resource uploads. */
export const finalizeUploadSchema = z.object({
  assetId: z.string().min(1),
});
