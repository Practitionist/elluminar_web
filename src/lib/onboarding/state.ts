import "server-only";

import { cache } from "react";

import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  ONBOARDING_STEPS,
  type OnboardingStep,
  type OnboardingAbout,
} from "@/lib/validation/onboarding";

/**
 * Onboarding progress, resolved from what is actually persisted.
 *
 * There is no draft table and no client-side wizard state: each step writes
 * its own columns the moment it is submitted, and the step to show is derived
 * from that. A refresh, a crash, or finishing on a different device all resume
 * in the same place — and the Prisma schema stays frozen (issue #43), since
 * progress rides in PortfolioProfile.about, a Json column that already exists.
 */

export type OnboardingProgress = {
  completed: boolean;
  /** Authoritative next step. `null` once every step is done. */
  currentStep: OnboardingStep | null;
  completedSteps: OnboardingStep[];
  values: {
    name: string;
    phone: string;
    timezone: string;
    locale: "en" | "hi";
    goal: string | null;
    experienceLevel: string | null;
    interests: string[];
    headline: string;
    marketingOptIn: boolean;
    productEmails: boolean;
    mentorFeedbackEmails: boolean;
    cohortRemindersEmails: boolean;
  };
};

/** Shape we actually write into PortfolioProfile.about during onboarding. */
type StoredAbout = Partial<OnboardingAbout> & {
  onboardingSteps?: string[];
};

const NOTIFICATION_DEFAULTS = {
  product: true,
  mentorFeedback: true,
  cohortReminders: true,
};

export const getOnboardingProgress = cache(
  async (): Promise<OnboardingProgress> => {
    const session = await requireUser("/welcome");

    const [user, portfolio, preference] = await Promise.all([
      db.user.findUniqueOrThrow({
        where: { id: session.user.id },
        select: {
          name: true,
          phone: true,
          timezone: true,
          locale: true,
          marketingOptIn: true,
          onboardedAt: true,
        },
      }),
      db.portfolioProfile.findUnique({
        where: { userId: session.user.id },
        select: { headline: true, about: true },
      }),
      db.notificationPreference.findUnique({
        where: { userId: session.user.id },
        select: { prefs: true },
      }),
    ]);

    const about = (portfolio?.about ?? {}) as StoredAbout;
    const prefs = (preference?.prefs ?? {}) as Partial<typeof NOTIFICATION_DEFAULTS>;

    const completedSteps = ONBOARDING_STEPS.filter((step) =>
      (about.onboardingSteps ?? []).includes(step),
    );

    return {
      completed: user.onboardedAt !== null,
      currentStep: ONBOARDING_STEPS.find((s) => !completedSteps.includes(s)) ?? null,
      completedSteps,
      values: {
        name: user.name,
        phone: user.phone ?? "",
        timezone: user.timezone,
        locale: user.locale === "hi" ? "hi" : "en",
        goal: about.goal ?? null,
        experienceLevel: about.experienceLevel ?? null,
        interests: about.interests ?? [],
        headline: portfolio?.headline ?? "",
        marketingOptIn: user.marketingOptIn,
        productEmails: prefs.product ?? NOTIFICATION_DEFAULTS.product,
        mentorFeedbackEmails: prefs.mentorFeedback ?? NOTIFICATION_DEFAULTS.mentorFeedback,
        cohortRemindersEmails:
          prefs.cohortReminders ?? NOTIFICATION_DEFAULTS.cohortReminders,
      },
    };
  },
);

/**
 * Resolves the step to render. A `?step=` the user hasn't earned yet is
 * ignored in favour of the first unfinished one — you can go back and revise,
 * but not skip ahead past a step whose answers later steps might depend on.
 */
export function resolveStep(
  requested: string | undefined,
  progress: OnboardingProgress,
): OnboardingStep {
  const furthest = progress.currentStep ?? ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
  if (!requested) return furthest;

  const asStep = ONBOARDING_STEPS.find((s) => s === requested);
  if (!asStep) return furthest;

  const allowed =
    progress.completedSteps.includes(asStep) ||
    asStep === progress.currentStep ||
    progress.completed;

  return allowed ? asStep : furthest;
}

/** Interest chips, from the live catalog rather than a hardcoded list. */
export const getInterestOptions = cache(async () => {
  return db.category.findMany({
    where: { parentId: null },
    select: { slug: true, name: true, icon: true },
    orderBy: [{ sort: "asc" }, { name: "asc" }],
    take: 24,
  });
});
