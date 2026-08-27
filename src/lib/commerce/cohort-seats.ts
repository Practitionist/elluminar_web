/**
 * Cohort seat availability (pure, unit-testable).
 *
 * Enforced in `createCheckout` BEFORE a payment order is created. The
 * fulfillment path runs after money has moved, so it can only warn — refusing
 * there would strand a learner who has already paid.
 */

export type CohortSeatState = {
  status: string;
  capacity: number | null;
  taken: number;
  enrollmentClosesAt: Date | null;
  now?: Date;
};

export type CohortSeatBlock = "not-open" | "closed" | "full" | null;

/** The reason a seat can't be sold, or null when it can. */
export function cohortSeatBlocker(state: CohortSeatState): CohortSeatBlock {
  const now = state.now ?? new Date();
  if (state.status !== "OPEN") return "not-open";
  if (state.enrollmentClosesAt && now > state.enrollmentClosesAt) return "closed";
  // A null capacity means uncapped, not zero.
  if (state.capacity != null && state.taken >= state.capacity) return "full";
  return null;
}
