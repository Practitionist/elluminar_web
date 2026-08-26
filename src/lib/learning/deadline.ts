/**
 * Assignment deadline math (pure, unit-testable).
 *
 * A due date is derived from the learner's enrollment activation:
 *   dueAt = enrollment.activatedAt + assignment.dueOffsetDays days
 * No dueOffsetDays ⇒ no deadline (always allowed).
 */

export type DeadlineVerdict =
  | { action: "allow"; dueAt: Date | null }
  | { action: "flag-late"; dueAt: Date }
  | { action: "reject"; dueAt: Date };

const DAY_MS = 86_400_000;

export function getDueDate(
  activatedAt: Date,
  dueOffsetDays: number | null | undefined,
): Date | null {
  if (dueOffsetDays == null) return null;
  return new Date(activatedAt.getTime() + dueOffsetDays * DAY_MS);
}

export function evaluateDeadline(input: {
  activatedAt: Date;
  dueOffsetDays: number | null | undefined;
  allowLate: boolean;
  now?: Date;
}): DeadlineVerdict {
  const now = input.now ?? new Date();
  const dueAt = getDueDate(input.activatedAt, input.dueOffsetDays);
  if (!dueAt) return { action: "allow", dueAt: null };
  if (now.getTime() <= dueAt.getTime()) return { action: "allow", dueAt };
  if (input.allowLate) return { action: "flag-late", dueAt };
  return { action: "reject", dueAt };
}
