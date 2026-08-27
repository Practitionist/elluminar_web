import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  resetPasswordSchema,
  scorePassword,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

describe("signUpSchema", () => {
  const valid = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "correct-horse-battery",
    confirmPassword: "correct-horse-battery",
    acceptTerms: true as const,
    marketingOptIn: false,
  };

  it("accepts a complete sign-up", () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects mismatched passwords and blames the confirm field", () => {
    const result = signUpSchema.safeParse({ ...valid, confirmPassword: "something-else" });
    expect(result.success).toBe(false);
    // The message has to land on confirmPassword, not password — otherwise the
    // error renders under the field the user probably typed correctly.
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("requires the terms checkbox, not merely a boolean", () => {
    expect(signUpSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });

  it("enforces BetterAuth's 8-character floor", () => {
    const result = signUpSchema.safeParse({
      ...valid,
      password: "short12",
      confirmPassword: "short12",
    });
    expect(result.success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("does not impose a length rule on an existing password", () => {
    // A pre-existing account may predate any policy we add, and telling the
    // world our minimum on the sign-in form leaks it for no benefit.
    expect(
      signInSchema.safeParse({ email: "ada@example.com", password: "x" }).success,
    ).toBe(true);
  });

  it("still requires a password to be present", () => {
    expect(
      signInSchema.safeParse({ email: "ada@example.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  const base = {
    currentPassword: "old-password-1",
    newPassword: "brand-new-password",
    confirmPassword: "brand-new-password",
  };

  it("accepts a valid rotation", () => {
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
  });

  it("refuses to 'change' a password to the same value", () => {
    const same = "same-password-99";
    const result = changePasswordSchema.safeParse({
      currentPassword: same,
      newPassword: same,
      confirmPassword: same,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["newPassword"]);
  });

  it("defaults to revoking other sessions", () => {
    const result = changePasswordSchema.parse(base);
    expect(result.revokeOtherSessions).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("requires the confirmation to match", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "a-good-password",
        confirmPassword: "a-different-one",
      }).success,
    ).toBe(false);
  });
});

describe("scorePassword", () => {
  it("reports anything under 8 characters as too short", () => {
    expect(scorePassword("abc").score).toBe(0);
    expect(scorePassword("abc").label).toBe("Too short");
  });

  it("never scores an accepted password as 0", () => {
    // The meter is advisory. Showing "0/4" for a password the server accepts
    // would read as a rejection.
    expect(scorePassword("aaaaaaaa").score).toBeGreaterThan(0);
  });

  it("rewards length and character variety", () => {
    const weak = scorePassword("aaaaaaaa").score;
    const strong = scorePassword("Tr0ub4dor&3xKcd-Horse").score;
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBe(4);
  });

  it("stops hinting once the password is strong", () => {
    expect(scorePassword("Tr0ub4dor&3xKcd-Horse").hint).toBeNull();
    expect(scorePassword("aaaaaaaa").hint).not.toBeNull();
  });

  it("stays within 0–4 for pathological input", () => {
    const score = scorePassword("A1!".repeat(200)).score;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(4);
  });
});
