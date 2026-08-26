import { Prisma } from "@/generated/prisma/client";

/**
 * Unique-violation introspection that survives Prisma 7's driver-adapter shape.
 *
 * Prisma 7 with @prisma/adapter-pg no longer populates `meta.target` — the field
 * the error reference still documents. A P2002 now carries the violated columns
 * at `meta.driverAdapterError.cause.constraint` (prisma/prisma#28953), which the
 * pg adapter fills by regex-parsing Postgres' `DETAIL: Key (a, b)=(…) already
 * exists`. Two consequences that a naive read gets wrong:
 *
 *   - camelCase columns arrive quote-wrapped, e.g. `"attemptNo"`, because
 *     Postgres quotes identifiers that need it in DETAIL;
 *   - `constraint` is `undefined` when the driver produced no DETAIL, so absence
 *     of column info must not be read as "different constraint".
 */

type DriverConstraint = { fields?: string[]; index?: string } | undefined;

function isP2002(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Columns named by a P2002, normalized (quotes stripped), or `null` when the
 * driver did not say which constraint was hit.
 */
export function uniqueViolationColumns(err: unknown): string[] | null {
  if (!isP2002(err)) return null;
  const meta = err.meta as
    | {
        target?: string | string[];
        driverAdapterError?: { cause?: { constraint?: DriverConstraint } };
      }
    | undefined;

  const constraint = meta?.driverAdapterError?.cause?.constraint;
  const fromAdapter = constraint?.fields ?? (constraint?.index ? [constraint.index] : undefined);
  // Non-adapter engines (and older Prisma) still populate meta.target.
  const fromTarget = meta?.target
    ? Array.isArray(meta.target)
      ? meta.target
      : [meta.target]
    : undefined;

  const source = fromAdapter ?? fromTarget;
  if (!source) return null;
  const columns = source.map((c) => c.replaceAll('"', "").trim()).filter(Boolean);
  return columns.length > 0 ? columns : null;
}

/** P2003 — a foreign key constraint rejected the write. */
export function isForeignKeyViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";
}

/**
 * True when `err` is a unique violation involving every one of `columns`.
 *
 * When the driver reports no column detail we fall back to the bare P2002 code
 * rather than skipping the caller's recovery path — matching the convention in
 * `credentials/issue.ts` and `enterprise/credit.ts`, and failing toward the
 * retry the caller wrote instead of a masked "something went wrong".
 */
export function isUniqueViolationOn(err: unknown, ...columns: string[]): boolean {
  if (!isP2002(err)) return false;
  const found = uniqueViolationColumns(err);
  if (found === null) return true;
  // `index` form gives one constraint name containing the column names.
  return columns.every((c) => found.some((f) => f === c || f.includes(c)));
}
