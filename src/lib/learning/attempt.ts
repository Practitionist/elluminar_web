/**
 * Quiz attempt expiry (pure, unit-testable).
 *
 * The countdown in the quiz runner is a convenience. This is the control: the
 * server action can be called directly, long after the timer visually expired.
 */

/** Absorbs clock skew and a submit that was already in flight when time ran out. */
export const ATTEMPT_GRACE_MS = 10_000;

export function isAttemptExpired(
  dueAt: Date | null | undefined,
  now: Date = new Date(),
  graceMs: number = ATTEMPT_GRACE_MS,
): boolean {
  if (!dueAt) return false; // no time limit configured
  return now.getTime() > dueAt.getTime() + graceMs;
}
