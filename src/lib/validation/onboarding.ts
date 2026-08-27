import { z } from "zod";

/**
 * Learner onboarding. One schema per step, each persisted the moment it is
 * submitted — the wizard holds no client-side draft state, so a refresh or a
 * different device resumes exactly where the user left off.
 *
 * Every field here lands in a column that already exists (the Prisma schema is
 * frozen — issue #43): User.{name,phone,timezone,locale,marketingOptIn,
 * onboardedAt}, PortfolioProfile.{headline,about}, NotificationPreference.prefs.
 */

export const ONBOARDING_STEPS = ["profile", "goals", "comms"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const EXPERIENCE_LEVELS = [
  { value: "student", label: "Student", hint: "In school or university" },
  { value: "switching", label: "Switching into tech", hint: "From another field" },
  { value: "junior", label: "0–2 years", hint: "Early career" },
  { value: "mid", label: "3–6 years", hint: "Mid-level" },
  { value: "senior", label: "7+ years", hint: "Senior and above" },
] as const;

export const LEARNING_GOALS = [
  { value: "first-job", label: "Land my first job" },
  { value: "switch-roles", label: "Switch roles or companies" },
  { value: "promotion", label: "Level up where I am" },
  { value: "specific-skill", label: "Learn a specific skill" },
  { value: "portfolio", label: "Build a portfolio I can show" },
  { value: "exploring", label: "Just exploring" },
] as const;

export const experienceLevelSchema = z.enum(
  EXPERIENCE_LEVELS.map((l) => l.value) as [string, ...string[]],
);
export const learningGoalSchema = z.enum(
  LEARNING_GOALS.map((g) => g.value) as [string, ...string[]],
);

/**
 * IANA zone. Validated against the runtime's own tz database rather than a
 * hardcoded list, so it stays correct as zones are added or renamed.
 */
export const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Pick a valid timezone" },
  );

export const onboardingProfileSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    // E.164-ish, but permissive: a convenience field, never a login factor.
    .regex(/^\+?[0-9][0-9\s-]{6,19}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  timezone: timezoneSchema,
  locale: z.enum(["en", "hi"]).default("en"),
});

export const onboardingGoalsSchema = z.object({
  goal: learningGoalSchema,
  experienceLevel: experienceLevelSchema,
  /** Category slugs, re-checked against the DB in the action before persisting. */
  interests: z
    .array(z.string().min(1).max(64))
    .min(1, "Pick at least one area")
    .max(8, "Pick up to 8 areas"),
  headline: z.string().trim().max(120).optional().or(z.literal("")),
});

export const onboardingCommsSchema = z.object({
  marketingOptIn: z.boolean().default(false),
  productEmails: z.boolean().default(true),
  mentorFeedbackEmails: z.boolean().default(true),
  cohortRemindersEmails: z.boolean().default(true),
});

/** `skipped` is a first-class outcome: it still stamps onboardedAt so we stop asking. */
export const completeOnboardingSchema = z.object({
  skipped: z.boolean().default(false),
});

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;
export type OnboardingGoalsInput = z.infer<typeof onboardingGoalsSchema>;
export type OnboardingCommsInput = z.infer<typeof onboardingCommsSchema>;

/** Shape stored in PortfolioProfile.about (Json?) by the goals step. */
export type OnboardingAbout = {
  goal: string;
  experienceLevel: string;
  interests: string[];
  capturedAt: string;
};
