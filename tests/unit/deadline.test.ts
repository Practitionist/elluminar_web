import { describe, expect, it } from "vitest";

import { evaluateDeadline, getDueDate } from "@/lib/learning/deadline";

const DAY_MS = 86_400_000;
const ACTIVATED_AT = new Date("2026-08-01T09:00:00Z");

const input = (overrides: {
  dueOffsetDays?: number | null;
  allowLate?: boolean;
  now?: Date;
}) => ({
  activatedAt: ACTIVATED_AT,
  dueOffsetDays: 7,
  allowLate: true,
  ...overrides,
});

describe("getDueDate", () => {
  it("adds the offset to enrollment activation", () => {
    expect(getDueDate(ACTIVATED_AT, 7)).toEqual(new Date(ACTIVATED_AT.getTime() + 7 * DAY_MS));
  });

  it("returns null when there is no offset (open-ended)", () => {
    expect(getDueDate(ACTIVATED_AT, null)).toBeNull();
    expect(getDueDate(ACTIVATED_AT, undefined)).toBeNull();
  });
});

describe("evaluateDeadline", () => {
  const beforeDue = new Date("2026-08-05T00:00:00Z");
  const afterDue = new Date("2026-08-10T00:00:00Z");

  it("allows submissions before the deadline", () => {
    const verdict = evaluateDeadline(input({ now: beforeDue }));
    expect(verdict).toEqual({ action: "allow", dueAt: new Date("2026-08-08T09:00:00Z") });
  });

  it("flags late but accepts after the deadline when allowLate is on", () => {
    const verdict = evaluateDeadline(input({ now: afterDue }));
    expect(verdict.action).toBe("flag-late");
    if (verdict.action === "flag-late") {
      expect(verdict.dueAt).toEqual(new Date("2026-08-08T09:00:00Z"));
    }
  });

  it("rejects after the deadline when allowLate is off", () => {
    const verdict = evaluateDeadline(input({ now: afterDue, allowLate: false }));
    expect(verdict.action).toBe("reject");
    if (verdict.action === "reject") {
      expect(verdict.dueAt).toEqual(new Date("2026-08-08T09:00:00Z"));
    }
  });

  it("always allows when no deadline is configured", () => {
    const verdict = evaluateDeadline(
      input({ dueOffsetDays: null, allowLate: false, now: afterDue }),
    );
    expect(verdict).toEqual({ action: "allow", dueAt: null });
  });

  it("treats the exact deadline instant as on time", () => {
    const verdict = evaluateDeadline({ ...input({}), now: new Date("2026-08-08T09:00:00Z") });
    expect(verdict.action).toBe("allow");
  });

  it("accepts a zero-day deadline (due at activation)", () => {
    const late = evaluateDeadline({
      activatedAt: ACTIVATED_AT,
      dueOffsetDays: 0,
      allowLate: false,
      now: new Date("2026-08-02T09:00:01Z"),
    });
    expect(late.action).toBe("reject");
  });
});
