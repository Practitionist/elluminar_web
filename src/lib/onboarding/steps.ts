import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/validation/onboarding";

/**
 * Pure step arithmetic, deliberately kept out of `state.ts` — that module is
 * `server-only` and imports Prisma, so nothing there can be unit-tested
 * without a database.
 */

export type StepPosition = {
  completedSteps: OnboardingStep[];
  /** First unfinished step, or null when they're all done. */
  currentStep: OnboardingStep | null;
  completed: boolean;
};

export function stepPosition(
  completedSteps: OnboardingStep[],
  completed: boolean,
): StepPosition {
  const done = ONBOARDING_STEPS.filter((s) => completedSteps.includes(s));
  return {
    completedSteps: done,
    currentStep: ONBOARDING_STEPS.find((s) => !done.includes(s)) ?? null,
    completed,
  };
}

/**
 * Resolves which step to render.
 *
 * A `?step=` the user hasn't reached is ignored in favour of the first
 * unfinished one: going back to revise is fine, skipping ahead is not, because
 * a later step's defaults can depend on answers an earlier one hasn't
 * collected. An unknown value falls back the same way rather than 404ing.
 */
export function resolveStep(
  requested: string | undefined,
  position: StepPosition,
): OnboardingStep {
  const furthest =
    position.currentStep ?? ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]!;

  if (!requested) return furthest;

  const asStep = ONBOARDING_STEPS.find((s) => s === requested);
  if (!asStep) return furthest;

  const allowed =
    position.completed ||
    position.completedSteps.includes(asStep) ||
    asStep === position.currentStep;

  return allowed ? asStep : furthest;
}
