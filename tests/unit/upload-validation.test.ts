import { describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_BYTES,
  mediaKindForMime,
  RESOURCE_MIME_ALLOWLIST,
  SUBMISSION_MIME_ALLOWLIST,
} from "@/lib/learning/uploads";

describe("SUBMISSION_MIME_ALLOWLIST", () => {
  it("covers exactly pdf/png/jpg/webp/zip", () => {
    expect([...SUBMISSION_MIME_ALLOWLIST].sort()).toEqual(
      [
        "application/pdf",
        "application/x-zip-compressed",
        "application/zip",
        "image/jpeg",
        "image/png",
        "image/webp",
      ].sort(),
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
