import { z } from "zod";

import { slugSchema } from "@/lib/validation/tenant";

// ── Tenant creation ──────────────────────────────────────────────────

export const enterpriseTenantTypeSchema = z.enum(["ENTERPRISE", "UNIVERSITY"]);

export const adminCreateEnterpriseTenantSchema = z.object({
  name: z.string().min(2).max(80),
  slug: slugSchema,
  type: enterpriseTenantTypeSchema,
  primaryAdminEmail: z.email(),
  about: z.string().max(2000).optional(),
});

export const applyAsOrganizationSchema = z.object({
  name: z.string().min(2).max(80),
  slug: slugSchema,
  type: z.enum(["CREATOR", "ENTERPRISE", "UNIVERSITY"]),
  about: z.string().max(2000).optional(),
  supportEmail: z.email().optional().or(z.literal("")),
});

// ── Licenses ─────────────────────────────────────────────────────────

const licenseBase = {
  tenantSlug: slugSchema,
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  contractRef: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
};

export const createLicenseSchema = z
  .discriminatedUnion("kind", [
    z.object({
      ...licenseBase,
      kind: z.literal("CATALOG"),
      seats: z.number().int().min(1).max(100000),
      contractValueRupees: z.number().nonnegative().optional(),
      catalogCourseIds: z.array(z.string().min(1)).max(500).default([]),
    }),
    z.object({
      ...licenseBase,
      kind: z.literal("PROGRAM"),
      seats: z.number().int().min(1).max(100000),
      programId: z.string().min(1),
      contractValueRupees: z.number().nonnegative().optional(),
    }),
    z.object({
      ...licenseBase,
      kind: z.literal("CREDIT_POOL"),
      contractValueRupees: z.number().positive().max(100_000_000),
    }),
  ])
  .refine((v) => v.endsAt > v.startsAt, {
    message: "End date must be after the start date.",
  });

export const recordLicensePaymentSchema = z.object({
  licenseId: z.string().min(1),
  amountRupees: z.number().positive(),
  reference: z.string().max(120).optional(),
});

export const licenseIdInput = z.object({
  tenantSlug: slugSchema,
  licenseId: z.string().min(1),
});

// ── Roster ───────────────────────────────────────────────────────────

export const rosterRowSchema = z.object({
  email: z.email(),
  name: z.string().max(120).optional(),
});

export const importRosterSchema = z.object({
  tenantSlug: slugSchema,
  licenseId: z.string().min(1),
  csv: z.string().min(3).max(500_000),
});

export const seatActionSchema = z.object({
  tenantSlug: slugSchema,
  seatId: z.string().min(1),
});

export const transferSeatSchema = seatActionSchema.extend({
  newEmail: z.email(),
});

// ── Programs ─────────────────────────────────────────────────────────

export const upsertProgramSchema = z.object({
  tenantSlug: slugSchema,
  programId: z.string().optional(),
  title: z.string().min(3).max(140),
  slug: slugSchema,
  description: z.string().max(5000).optional(),
  certificateTemplateId: z.string().optional().nullable(),
  coBrandPartnerName: z.string().max(120).optional(),
});

export const programItemSchema = z.object({
  tenantSlug: slugSchema,
  programId: z.string().min(1),
  itemType: z.enum(["COURSE", "PROJECT"]),
  courseId: z.string().optional(),
  projectId: z.string().optional(),
  required: z.boolean().default(true),
});

export const setUnlockRuleSchema = z.object({
  tenantSlug: slugSchema,
  programId: z.string().min(1),
  itemId: z.string().min(1),
  unlockAfterItemId: z.string().nullable(),
});

export const upsertProgramCohortSchema = z.object({
  tenantSlug: slugSchema,
  programId: z.string().min(1),
  cohortId: z.string().optional(),
  name: z.string().min(2).max(120),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  capacity: z.number().int().positive().max(100000).optional().nullable(),
});

export const bulkEnrollSchema = z.object({
  tenantSlug: slugSchema,
  programCohortId: z.string().min(1),
  seatIds: z.array(z.string().min(1)).min(1).max(1000),
});

// ── Redemption / reports / SSO ───────────────────────────────────────

export const redeemSchema = z.object({
  licenseId: z.string().min(1),
  itemType: z.enum(["COURSE", "PROJECT"]),
  courseId: z.string().optional(),
  projectId: z.string().optional(),
});

export const requestReportSchema = z.object({
  tenantSlug: slugSchema,
  kind: z.enum(["COMPLETION", "COMPLIANCE", "SKILL_GAP", "ENGAGEMENT"]),
  programCohortId: z.string().optional(),
});

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "rediffmail.com",
  "zoho.com",
]);

export const registerSsoProviderSchema = z
  .object({
    tenantSlug: slugSchema,
    providerId: slugSchema,
    domain: z
      .string()
      .min(4)
      .max(255)
      .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Enter a bare domain like acme.com"),
    issuer: z.url(),
    clientId: z.string().min(1).max(500),
    clientSecret: z.string().min(1).max(500),
  })
  .refine((v) => !FREE_MAIL_DOMAINS.has(v.domain.toLowerCase()), {
    message: "Public email domains cannot be used for SSO.",
    path: ["domain"],
  });
