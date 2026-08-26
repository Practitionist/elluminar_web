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
const TEXT_MIMES = ["text/plain", "text/markdown", "text/csv"];
const OFFICE_MIMES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/**
 * Learner submissions (assignments and project milestones): PDF, images,
 * archives, Office documents and plain text.
 *
 * Office formats belong here, not just on the creator side. A design, business
 * or data capstone is routinely delivered as a .pptx or .xlsx, and rejecting
 * those forced learners to zip their work or find a file host — while creators
 * could attach the very same formats to a RESOURCE lesson.
 */
export const SUBMISSION_MIME_ALLOWLIST = [
  "application/pdf",
  ...IMAGE_MIMES,
  ...ARCHIVE_MIMES,
  ...OFFICE_MIMES,
  ...TEXT_MIMES,
] as const;

/** Creator RESOURCE lessons: everything a learner may submit, plus GIF. */
export const RESOURCE_MIME_ALLOWLIST = [
  ...SUBMISSION_MIME_ALLOWLIST,
  "image/gif",
] as const;

export type UploadMediaKind = "IMAGE" | "DOCUMENT" | "ARCHIVE";

export function mediaKindForMime(mime: string): UploadMediaKind {
  if (mime.startsWith("image/")) return "IMAGE";
  if (ARCHIVE_MIMES.includes(mime as (typeof ARCHIVE_MIMES)[number])) return "ARCHIVE";
  return "DOCUMENT";
}

/**
 * Extension → MIME, for the file picker. Browsers omit `File.type` for some
 * Office and text files, so the client falls back to the extension; the server
 * still validates the MIME against the allowlist above, which is the real gate.
 */
export const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
};

/** `accept` attribute for learner submission pickers. Derived, never hand-listed. */
export const SUBMISSION_ACCEPT_ATTR = Object.entries(MIME_BY_EXT)
  .filter(([, mime]) => (SUBMISSION_MIME_ALLOWLIST as readonly string[]).includes(mime))
  .map(([ext]) => `.${ext}`)
  .join(",");

/** Best-effort MIME for a picked file: the browser's type, else the extension. */
export function mimeForFilename(filename: string, browserType?: string): string {
  if (browserType) return browserType;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "";
}

export const MAX_SUBMISSION_FILES = 5;
