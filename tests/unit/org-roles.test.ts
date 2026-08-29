import { describe, expect, it } from "vitest";

import { canGrade, hasOrgRole, isPlatformAdmin, parseOrgRoles } from "@/lib/auth/roles";

/**
 * Regression cover for the grading authorization hole: `gradeAssignmentSubmission`
 * used to accept ANY organization membership, so an enterprise learner — who
 * holds a plain `member` row in the buying org — could grade a peer's work.
 */

describe("parseOrgRoles", () => {
  it("splits BetterAuth's comma-separated role string", () => {
    expect(parseOrgRoles("owner,instructor")).toEqual(["owner", "instructor"]);
  });

  it("tolerates whitespace and empty segments", () => {
    expect(parseOrgRoles(" owner , , instructor ")).toEqual(["owner", "instructor"]);
  });

  it("treats null/undefined/empty as no roles", () => {
    expect(parseOrgRoles(null)).toEqual([]);
    expect(parseOrgRoles(undefined)).toEqual([]);
    expect(parseOrgRoles("")).toEqual([]);
  });
});

describe("hasOrgRole", () => {
  it("matches when ANY held role is allowed", () => {
    expect(hasOrgRole("instructor,member", ["owner", "admin", "instructor"])).toBe(true);
  });

  it("does not match on substrings of a role name", () => {
    expect(hasOrgRole("administrator", ["admin"])).toBe(false);
  });
});

describe("canGrade", () => {
  const cases: Array<[string | null | undefined, boolean]> = [
    ["owner", true],
    ["admin", true],
    ["instructor", true],
    ["instructor,member", true],
    ["member,instructor", true],
    // The hole this closes: a seat-provisioned learner must never grade.
    ["member", false],
    ["", false],
    [null, false],
    [undefined, false],
  ];

  it.each(cases)("membership %s → %s", (membershipRole, expected) => {
    expect(canGrade({ membershipRole, isPlatformAdmin: false })).toBe(expected);
  });

  it("lets platform staff grade without an org membership", () => {
    expect(canGrade({ membershipRole: null, isPlatformAdmin: true })).toBe(true);
  });

  it("does not let a plain member borrow authority from another org role name", () => {
    expect(canGrade({ membershipRole: "member", isPlatformAdmin: false })).toBe(false);
  });
});

describe("isPlatformAdmin", () => {
  it("is true only for the exact admin role", () => {
    expect(isPlatformAdmin("admin")).toBe(true);
  });

  it("treats a missing role as the default 'user'", () => {
    // Two call sites previously omitted the `?? "user"` default. Equivalent in
    // practice, but the point of one predicate is that they cannot diverge.
    expect(isPlatformAdmin(undefined)).toBe(false);
    expect(isPlatformAdmin(null)).toBe(false);
    expect(isPlatformAdmin("")).toBe(false);
  });

  it("does not match near-misses", () => {
    expect(isPlatformAdmin("Admin")).toBe(false);
    expect(isPlatformAdmin("administrator")).toBe(false);
    expect(isPlatformAdmin("user")).toBe(false);
    expect(isPlatformAdmin("owner")).toBe(false);
  });
});
