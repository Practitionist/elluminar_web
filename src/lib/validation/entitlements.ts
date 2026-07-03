import { z } from "zod";

/**
 * The Zod-typed contract for SubscriptionPlan.entitlements (learner audience).
 * Seed data and the entitlement service both parse through this — the Json
 * column never carries an unvalidated shape.
 */
export const learnerEntitlementsSchema = z.object({
  /** Full self-paced library access (Learn tier and above). */
  libraryAccess: z.boolean().default(false),
  /** Live cohort access level. */
  cohortAccess: z.enum(["NONE", "REPLAY", "INCLUDED", "PRIORITY"]).default("NONE"),
  /** Discount on Capstone-tier projects at checkout. */
  capstoneDiscountBps: z.number().int().min(0).max(10000).default(0),
  /** Small discount on all à la carte purchases. */
  alaCarteDiscountBps: z.number().int().min(0).max(10000).default(0),
  /** Sprint project credits granted per month (Mentor tier). */
  sprintCreditsPerMonth: z.number().int().min(0).default(0),
  /** Flagship project credits granted per year (Career tier; FeatureFlag-gated until Flagship ships). */
  flagshipCreditsPerYear: z.number().int().min(0).default(0),
  /** Jump the mentor-matching queue. */
  priorityMentorMatching: z.boolean().default(false),
  /** Visible in the hiring-partner talent pool (with user consent). */
  hiringVisibility: z.boolean().default(false),
  mockInterviewDiscountBps: z.number().int().min(0).max(10000).default(0),
  /** Placement-support intake (Career tier). */
  placementSupport: z.boolean().default(false),
  portfolioTier: z.enum(["BASIC", "VERIFIED"]).default("BASIC"),
  /** Daily AI-tutor credit allowance (metered wallet). */
  aiDailyCredits: z.number().int().min(0).default(0),
});

export type LearnerEntitlements = z.infer<typeof learnerEntitlementsSchema>;

/** Creator-audience plan entitlements (CREATOR_PRO). */
export const creatorEntitlementsSchema = z.object({
  commissionBps: z.number().int().min(0).max(10000),
  customDomain: z.boolean().default(false),
  prioritySupport: z.boolean().default(false),
});

export type CreatorEntitlements = z.infer<typeof creatorEntitlementsSchema>;

export const FREE_TIER_ENTITLEMENTS: LearnerEntitlements = learnerEntitlementsSchema.parse({});
