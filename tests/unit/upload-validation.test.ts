import { describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_BYTES,
  mediaKindForMime,
  RESOURCE_MIME_ALLOWLIST,
  SUBMISSION_MIME_ALLOWLIST,
} from "@/lib/learning/uploads";

describe("SUBMISSION_MIME_ALLOWLIST", () => {
  it("covers pdf, images, archives, Office documents and plain text", () => {
    expect([...SUBMISSION_MIME_ALLOWLIST].sort()).toEqual(
      [
        "application/pdf",
        "application/x-zip-compressed",
        "application/zip",
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/markdown",
        "text/csv",
      ].sort(),
    );
  });

  it("accepts the Office formats a design or business capstone ships as", () => {
    const list = SUBMISSION_MIME_ALLOWLIST as readonly string[];
    // .pptx and .xlsx were previously creator-only, so a learner had to zip them.
    expect(list).toContain(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(list).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(list).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("rejects executables and videos", () => {
    const list = SUBMISSION_MIME_ALLOWLIST as readonly string[];
    expect(list.includes("application/octet-stream")).toBe(false);
    expect(list.includes("video/mp4")).toBe(false);
    expect(list.includes("application/javascript")).toBe(false);
  });
});

describe("RESOURCE_MIME_ALLOWLIST", () => {
  it("is a superset of the submission allowlist", () => {
    for (const mime of SUBMISSION_MIME_ALLOWLIST) {
      expect(RESOURCE_MIME_ALLOWLIST).toContain(mime);
    }
  });

  it("includes documents and images beyond the submission set", () => {
    const list = RESOURCE_MIME_ALLOWLIST as readonly string[];
    expect(list.includes("application/msword")).toBe(true);
    expect(list).toContain("text/csv");
    expect(list).toContain("image/gif");
  });
});

describe("mediaKindForMime", () => {
  it("maps images to IMAGE", () => {
    expect(mediaKindForMime("image/png")).toBe("IMAGE");
    expect(mediaKindForMime("image/gif")).toBe("IMAGE");
  });

  it("maps zips to ARCHIVE", () => {
    expect(mediaKindForMime("application/zip")).toBe("ARCHIVE");
    expect(mediaKindForMime("application/x-zip-compressed")).toBe("ARCHIVE");
  });

  it("defaults everything else (pdf, office) to DOCUMENT", () => {
    expect(mediaKindForMime("application/pdf")).toBe("DOCUMENT");
    expect(mediaKindForMime("application/vnd.ms-excel")).toBe("DOCUMENT");
    expect(mediaKindForMime("text/plain")).toBe("DOCUMENT");
  });
});

describe("MAX_UPLOAD_BYTES", () => {
  it("is 25 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
  });
});
