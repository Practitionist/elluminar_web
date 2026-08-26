/**
 * Keyset ("seek") pagination for the studio grading queue.
 *
 * Offset pagination is wrong for this list: the queue shrinks as submissions are
 * graded, so a `skip` computed while viewing page 1 steps over rows that moved
 * forward, and a forward-only pager gives the grader no route back to them.
 * Seeking on the stable (submittedAt, id) tuple is stable under concurrent
 * grading — every row is visited exactly once regardless of what was graded.
 *
 * Every row in the queue has `submittedAt` set: `submitAssignment` stamps it on
 * create, and grading never clears it, so the nullable column is total here.
 */

export type QueueCursor = { submittedAt: Date; id: string };

/** `<epochMillis>_<id>` — compact, URL-safe, and stable across renders. */
export function serializeQueueCursor(cursor: QueueCursor): string {
  return `${cursor.submittedAt.getTime()}_${cursor.id}`;
}

export function parseQueueCursor(raw: string | undefined | null): QueueCursor | null {
  if (!raw) return null;
  const sep = raw.indexOf("_");
  if (sep <= 0) return null;
  const millis = Number(raw.slice(0, sep));
  const id = raw.slice(sep + 1);
  if (!Number.isFinite(millis) || !id) return null;
  // Finite but out of Date's range (|t| > 8.64e15) yields an Invalid Date, which
  // Prisma rejects with a validation error — a crafted ?after= would 500 the
  // page rather than just paging from nowhere.
  const submittedAt = new Date(millis);
  if (Number.isNaN(submittedAt.getTime())) return null;
  return { submittedAt, id };
}

/**
 * Prisma `where` fragment selecting rows strictly after the cursor under
 * `orderBy: [{ submittedAt: "asc" }, { id: "asc" }]`. The id leg is what keeps
 * submissions sharing a timestamp from being skipped or repeated.
 */
export type QueueCursorFilter =
  | Record<string, never>
  | { OR: [{ submittedAt: { gt: Date } }, { submittedAt: Date; id: { gt: string } }] };

export function queueCursorFilter(cursor: QueueCursor | null): QueueCursorFilter {
  if (!cursor) return {};
  return {
    OR: [
      { submittedAt: { gt: cursor.submittedAt } },
      { submittedAt: cursor.submittedAt, id: { gt: cursor.id } },
    ],
  };
}
