/**
 * Upload constraints for learner submissions and creator resources.
 * Pure data + mapping helpers so they are unit-testable without storage/db.
 *
 * NOTE: Supabase bucket-level MIME/size caps are a dashboard config step
 * (docs/DEPLOYMENT.md); these constants are the application-side gate.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp"];
const ARCHIVE_MIMES = ["application/zip", "application/x-zip-compressed"];

/** Learner file submissions: PDF / PNG / JPG / WEBP / ZIP. */
export const SUBMISSION_MIME_ALLOWLIST = [
  "application/pdf",
  ...IMAGE_MIMES,
  ...ARCHIVE_MIMES,
] as const;

/** Creator RESOURCE lessons: documents, images and archives. */
export const RESOURCE_MIME_ALLOWLIST = [
  ...SUBMISSION_MIME_ALLOWLIST,
  "image/gif",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type UploadMediaKind = "IMAGE" | "DOCUMENT" | "ARCHIVE";

export function mediaKindForMime(mime: string): UploadMediaKind {
  if (mime.startsWith("image/")) return "IMAGE";
  if (ARCHIVE_MIMES.includes(mime as (typeof ARCHIVE_MIMES)[number])) return "ARCHIVE";
  return "DOCUMENT";
}
