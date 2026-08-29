import { describe, expect, it } from "vitest";

import { asCourseLevel, asProjectTier } from "@/lib/catalog";

/**
 * Regression cover for a live production 500: `?level=` and `?tier=` reached a
 * Prisma enum filter through `as never`, so any unrecognised value threw
 * PrismaClientValidationError. `/courses?level=NOT_A_REAL_LEVEL` returned 500
 * on elluminar.netlify.app before this fix.
 */

describe("asCourseLevel", () => {
  it.each(["BEGINNER", "INTERMEDIATE", "ADVANCED"])("accepts %s", (v) => {
    expect(asCourseLevel(v)).toBe(v);
  });

  it("treats anything else as absent rather than throwing", () => {
    for (const v of ["NOT_A_REAL_LEVEL", "beginner", "Beginner", "", "SPRINT", "'; drop--"]) {
      expect(asCourseLevel(v)).toBeUndefined();
    }
    expect(asCourseLevel(undefined)).toBeUndefined();
  });
});

describe("asProjectTier", () => {
  it.each(["SPRINT", "CAPSTONE", "FLAGSHIP"])("accepts %s", (v) => {
    expect(asProjectTier(v)).toBe(v);
  });

  it("treats anything else as absent", () => {
    for (const v of ["ADVANCED", "sprint", "Sprint", "", "1"]) {
      expect(asProjectTier(v)).toBeUndefined();
    }
    expect(asProjectTier(undefined)).toBeUndefined();
  });

  it("does not accept the other enum's values", () => {
    // The two filters sit on adjacent routes; crossing them must not validate.
    expect(asProjectTier("BEGINNER")).toBeUndefined();
    expect(asCourseLevel("CAPSTONE")).toBeUndefined();
  });
});
