import { z } from "zod";

export const slugSchema = z
  .string()
  .min(3, "At least 3 characters")
  .max(48, "At most 48 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only");

export const createCreatorApplicationSchema = z.object({
  name: z.string().min(2, "Give your school a name").max(80),
  slug: slugSchema,
  about: z.string().max(2000).optional(),
  supportEmail: z.email().optional().or(z.literal("")),
});

export const updateTenantSettingsSchema = z.object({
  tenantSlug: slugSchema,
  displayName: z.string().min(2).max(80),
  about: z.string().max(5000).optional(),
  supportEmail: z.email().optional().or(z.literal("")),
  socials: z
    .object({
      website: z.url().optional().or(z.literal("")),
      youtube: z.url().optional().or(z.literal("")),
      x: z.url().optional().or(z.literal("")),
      linkedin: z.url().optional().or(z.literal("")),
    })
    .optional(),
});

export const reviewTenantSchema = z.object({
  tenantId: z.string().min(1),
  decision: z.enum(["APPROVED", "SUSPENDED"]),
});
