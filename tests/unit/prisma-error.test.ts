import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { isUniqueViolationOn, uniqueViolationColumns } from "@/lib/prisma-error";

/**
 * Regression cover for the Prisma 7 unique-violation shape.
 *
 * Prisma 7 + @prisma/adapter-pg stops populating `meta.target` and instead nests
 * the violated columns under `meta.driverAdapterError.cause.constraint`, filled
 * by parsing Postgres' DETAIL line — which quotes camelCase identifiers. A guard
 * written against `meta.target` is therefore silently always-false, which is how
 * the submission retry loop became dead code.
 */

function knownError(meta: Record<string, unknown>, code = "P2002") {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code,
    clientVersion: "7.8.0",
    meta,
  });
}

/** What @prisma/adapter-pg@7.8.0 actually produces for Postgres SQLSTATE 23505. */
const pgAdapterError = (fields: string[]) =>
  knownError({
    driverAdapterError: {
      cause: { kind: "UniqueConstraintViolation", constraint: { fields } },
    },
  });

describe("uniqueViolationColumns", () => {
  it("reads the Prisma 7 driver-adapter shape and strips Postgres' quoting", () => {
    const err = pgAdapterError(['"assignmentId"', '"userId"', '"attemptNo"']);
    expect(uniqueViolationColumns(err)).toEqual(["assignmentId", "userId", "attemptNo"]);
  });

  it("reads the constraint-name (index) shape", () => {
    const err = knownError({
      driverAdapterError: {
        cause: {
          kind: "UniqueConstraintViolation",
          constraint: { index: "AssignmentSubmission_assignmentId_userId_attemptNo_key" },
        },
      },
    });
    expect(uniqueViolationColumns(err)).toEqual([
      "AssignmentSubmission_assignmentId_userId_attemptNo_key",
    ]);
  });

  it("still reads legacy meta.target (non-adapter engines)", () => {
    expect(uniqueViolationColumns(knownError({ target: ["assignmentId", "attemptNo"] }))).toEqual([
      "assignmentId",
      "attemptNo",
    ]);
    expect(
      uniqueViolationColumns(knownError({ target: "AssignmentSubmission_attemptNo_key" })),
    ).toEqual(["AssignmentSubmission_attemptNo_key"]);
  });

  it("returns null when the driver reported no column detail", () => {
    expect(uniqueViolationColumns(knownError({ driverAdapterError: { cause: {} } }))).toBeNull();
    expect(uniqueViolationColumns(knownError({}))).toBeNull();
  });

  it("ignores non-P2002 and non-Prisma errors", () => {
    expect(uniqueViolationColumns(knownError({}, "P2003"))).toBeNull();
    expect(uniqueViolationColumns(new Error("nope"))).toBeNull();
  });
});

describe("isUniqueViolationOn", () => {
  it("matches the attempt-number unique on the real Prisma 7 pg shape", () => {
    const err = pgAdapterError(['"assignmentId"', '"userId"', '"attemptNo"']);
    expect(isUniqueViolationOn(err, "attemptNo")).toBe(true);
  });

  it("matches when the constraint name merely contains the column", () => {
    const err = knownError({
      driverAdapterError: {
        cause: { constraint: { index: "AssignmentSubmission_assignmentId_userId_attemptNo_key" } },
      },
    });
    expect(isUniqueViolationOn(err, "attemptNo")).toBe(true);
  });

  it("does not match an unrelated unique index", () => {
    expect(isUniqueViolationOn(pgAdapterError(['"email"']), "attemptNo")).toBe(false);
  });

  it("falls back to the bare P2002 when no column detail is available", () => {
    // Postgres omits DETAIL in some configurations; failing toward the caller's
    // recovery path beats masking the duplicate as an unknown server error.
    expect(isUniqueViolationOn(knownError({}), "attemptNo")).toBe(true);
  });

  it("is false for other error codes and plain errors", () => {
    expect(isUniqueViolationOn(knownError({}, "P2025"), "attemptNo")).toBe(false);
    expect(isUniqueViolationOn(new Error("boom"), "attemptNo")).toBe(false);
  });

  it("documents why the old meta.target guard was always false", () => {
    const err = pgAdapterError(['"assignmentId"', '"userId"', '"attemptNo"']);
    const legacyGuard = String(
      (err.meta as { target?: string[] } | null)?.target?.[0] ?? "",
    ).includes("assignmentId");
    expect(legacyGuard).toBe(false);
    expect(isUniqueViolationOn(err, "attemptNo")).toBe(true);
  });
});
