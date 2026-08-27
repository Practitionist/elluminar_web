import { describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_BYTES,
  mediaKindForMime,
  RESOURCE_MIME_ALLOWLIST,
  SUBMISSION_MIME_ALLOWLIST,
  mimeForFilename,
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
        "application/json",
        "application/x-ipynb+json",
        "application/sql",
        "image/vnd.adobe.photoshop",
        "application/illustrator",
        "application/x-figma",
        "application/x-sketch",
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

  it("accepts data/notebook and design deliverables", () => {
    const list = SUBMISSION_MIME_ALLOWLIST as readonly string[];
    expect(list).toContain("application/x-ipynb+json");
    expect(list).toContain("application/json");
    expect(list).toContain("image/vnd.adobe.photoshop");
    expect(list).toContain("application/x-figma");
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

describe("mimeForFilename", () => {
  it("trusts a real browser type", () => {
    expect(mimeForFilename("deck.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
  });

  it("falls back to the extension when the browser says nothing", () => {
    expect(mimeForFilename("analysis.ipynb", "")).toBe("application/x-ipynb+json");
    expect(mimeForFilename("mockup.fig")).toBe("application/x-figma");
  });

  it("treats octet-stream as unknown, not as an answer", () => {
    // Chrome reports octet-stream for .fig/.sketch; taking it literally would
    // reject the very design files the allowlist now permits.
    expect(mimeForFilename("mockup.fig", "application/octet-stream")).toBe("application/x-figma");
    expect(mimeForFilename("board.sketch", "application/octet-stream")).toBe("application/x-sketch");
  });

  it("returns empty for genuinely unknown extensions", () => {
    expect(mimeForFilename("payload.exe", "application/octet-stream")).toBe("");
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
