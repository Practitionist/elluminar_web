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

const ssoDomainSchema = z
  .string()
  .min(4)
  .max(255)
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Enter a bare domain like acme.com")
  // Normalize: the duplicate check and IdP domain matching compare exactly.
  .transform((v) => v.toLowerCase());

const ssoProviderIdentity = {
  tenantSlug: slugSchema,
  providerId: slugSchema,
  domain: ssoDomainSchema,
};

/**
 * OIDC arm. `issuer` must be a URL because we resolve
 * `{issuer}/.well-known/openid-configuration` against it before saving.
 */
export const registerOidcProviderSchema = z.object({
  ...ssoProviderIdentity,
  protocol: z.literal("oidc"),
  issuer: z.url("Enter the issuer URL, e.g. https://acme.okta.com"),
  clientId: z.string().min(1).max(500),
  clientSecret: z.string().min(1).max(500),
});

/**
 * PEM-armoured X.509 signing certificate, as every IdP exports it. We only
 * check the envelope here — `samlify` does the real parse at registration time,
 * and `registerOrgSsoProvider` surfaces its error.
 */
const x509CertSchema = z
  .string()
  .trim()
  .min(1, "Paste the IdP signing certificate")
  .max(16_000)
  .refine(
    (v) =>
      v.includes("-----BEGIN CERTIFICATE-----") &&
      v.includes("-----END CERTIFICATE-----"),
    { message: "Paste the full PEM certificate, including the BEGIN/END lines" },
  );

/**
 * SAML arm. `issuer` is the IdP entity ID — usually a URL but legitimately a
 * URN for some university IdPs, so it is a plain string (which is also what
 * BetterAuth's own register endpoint accepts: `issuer: z.string()`).
 *
 * SHA-1 and the other deprecated algorithms are absent from the enums on
 * purpose; see docs/auth/adr-002-enterprise-sso.md.
 */
export const registerSamlProviderSchema = z.object({
  ...ssoProviderIdentity,
  protocol: z.literal("saml"),
  issuer: z.string().min(1, "Enter the IdP entity ID").max(500),
  entryPoint: z.url("Enter the IdP SSO URL"),
  cert: x509CertSchema,
  wantAssertionsSigned: z.boolean().default(true),
  authnRequestsSigned: z.boolean().default(false),
  signatureAlgorithm: z.enum(["sha256", "sha512"]).default("sha256"),
  digestAlgorithm: z.enum(["sha256", "sha512"]).default("sha256"),
  identifierFormat: z
    .enum([
      "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
      "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
      "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
      "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
    ])
    .default("urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"),
});

export const registerSsoProviderSchema = z
  .discriminatedUnion("protocol", [
    registerOidcProviderSchema,
    registerSamlProviderSchema,
  ])
  .refine((v) => !FREE_MAIL_DOMAINS.has(v.domain), {
    message: "Public email domains cannot be used for SSO.",
    path: ["domain"],
  });

export type RegisterSsoProviderInput = z.infer<typeof registerSsoProviderSchema>;
export type SsoProtocol = RegisterSsoProviderInput["protocol"];

export const ssoProviderRefSchema = z.object({
  tenantSlug: slugSchema,
  providerId: z.string().min(1),
});
