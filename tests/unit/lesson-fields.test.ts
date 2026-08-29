import { describe, expect, it } from "vitest";

import type { LessonType } from "@/generated/prisma/client";
import { videoAssetIdForLessonType } from "@/lib/learning/lesson-fields";

/**
 * Regression cover for `upsertLesson`'s unconditional `videoAssetId ?? null`
 * write: every lesson type could carry a video asset that no surface renders,
 * and retyping a VIDEO lesson left the stale id behind on the row.
 */

const ASSET = "vidasset_abc123";

// `satisfies Record<LessonType, boolean>` makes a new enum member a compile
// error here rather than a silently untested gap.
const KEEPS_VIDEO = {
  VIDEO: true,
  ARTICLE: false,
  QUIZ: false,
  ASSIGNMENT: false,
  CODE_LAB: false,
  RESOURCE: false,
  EMBED: false,
} satisfies Record<LessonType, boolean>;

const cases = Object.entries(KEEPS_VIDEO) as Array<[LessonType, boolean]>;
const types = cases.map(([type]) => type);

describe("videoAssetIdForLessonType", () => {
  it.each(cases)("%s keeps a supplied asset id: %s", (type, keeps) => {
    expect(videoAssetIdForLessonType(type, ASSET)).toBe(keeps ? ASSET : null);
  });

  it.each(types)("%s normalises a missing asset id to null", (type) => {
    expect(videoAssetIdForLessonType(type, undefined)).toBeNull();
    expect(videoAssetIdForLessonType(type, null)).toBeNull();
  });

  it("only VIDEO keeps an asset id", () => {
    const kept = types.filter((type) => videoAssetIdForLessonType(type, ASSET) !== null);
    expect(kept).toEqual(["VIDEO"]);
  });

  it("clears a stale id when a VIDEO lesson is retyped", () => {
    // The transition case: the update always writes the gated value, so the
    // row's old videoAssetId cannot survive a switch away from VIDEO.
    expect(videoAssetIdForLessonType("ARTICLE", ASSET)).toBeNull();
  });
});
