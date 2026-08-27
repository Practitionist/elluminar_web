import { describe, expect, it } from "vitest";

import { cohortSeatBlocker } from "@/lib/commerce/cohort-seats";
import { ATTEMPT_GRACE_MS, isAttemptExpired } from "@/lib/learning/attempt";

const at = (iso: string) => new Date(iso);

describe("isAttemptExpired", () => {
  const due = at("2026-08-27T10:00:00.000Z");

  it("never expires an attempt with no time limit", () => {
    expect(isAttemptExpired(null, at("2030-01-01T00:00:00.000Z"))).toBe(false);
    expect(isAttemptExpired(undefined, at("2030-01-01T00:00:00.000Z"))).toBe(false);
  });

  it("allows a submit before the deadline", () => {
    expect(isAttemptExpired(due, at("2026-08-27T09:59:00.000Z"))).toBe(false);
  });

  it("allows a submit inside the grace window", () => {
    expect(isAttemptExpired(due, new Date(due.getTime() + ATTEMPT_GRACE_MS - 1))).toBe(false);
  });

  it("rejects a submit past the grace window", () => {
    expect(isAttemptExpired(due, new Date(due.getTime() + ATTEMPT_GRACE_MS + 1))).toBe(true);
  });

  it("rejects a direct call long after the timer visually expired", () => {
    // The bug this closes: the countdown lived only in quiz-runner.tsx, so the
    // server action could be invoked hours later with a full mark.
    expect(isAttemptExpired(due, at("2026-08-27T18:00:00.000Z"))).toBe(true);
  });
});

describe("cohortSeatBlocker", () => {
  const base = {
    status: "OPEN",
    capacity: 10,
    taken: 3,
    enrollmentClosesAt: null,
    now: at("2026-08-27T10:00:00.000Z"),
  };

  it("sells a seat when open, in-window and under capacity", () => {
    expect(cohortSeatBlocker(base)).toBeNull();
  });

  it("treats a null capacity as uncapped, not zero", () => {
    expect(cohortSeatBlocker({ ...base, capacity: null, taken: 9999 })).toBeNull();
  });

  it("blocks on the boundary, not one past it", () => {
    expect(cohortSeatBlocker({ ...base, taken: 9 })).toBeNull();
    expect(cohortSeatBlocker({ ...base, taken: 10 })).toBe("full");
    expect(cohortSeatBlocker({ ...base, taken: 11 })).toBe("full");
  });

  it.each(["DRAFT", "RUNNING", "COMPLETED", "CANCELLED"])("blocks a %s cohort", (status) => {
    expect(cohortSeatBlocker({ ...base, status })).toBe("not-open");
  });

  it("blocks once the enrolment window has closed", () => {
    expect(
      cohortSeatBlocker({ ...base, enrollmentClosesAt: at("2026-08-27T09:00:00.000Z") }),
    ).toBe("closed");
  });

  it("still sells while the window is open", () => {
    expect(
      cohortSeatBlocker({ ...base, enrollmentClosesAt: at("2026-08-27T11:00:00.000Z") }),
    ).toBeNull();
  });

  it("reports not-open before window/capacity when several conditions fail", () => {
    expect(
      cohortSeatBlocker({
        ...base,
        status: "CANCELLED",
        taken: 99,
        enrollmentClosesAt: at("2020-01-01T00:00:00.000Z"),
      }),
    ).toBe("not-open");
  });
});
