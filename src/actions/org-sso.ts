"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionError, adminActionClient, orgActionClient } from "@/lib/safe-action";
import { registerSsoProviderSchema } from "@/lib/validation/enterprise";
import { slugSchema } from "@/lib/validation/tenant";

const orgOwnerClient = orgActionClient(["owner", "admin"]);

/**
 * Registers an OIDC provider for the organization (BetterAuth SSO plugin).
 * Providers stay unverified (no domain-based auto-provisioning trust) until a
 * platform admin flips domainVerified — prevents domain-hijack provisioning.
 */
export const registerOrgSsoProvider = orgOwnerClient
  .inputSchema(registerSsoProviderSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await db.ssoProvider.findFirst({
      where: {
        OR: [{ providerId: parsedInput.providerId }, { domain: parsedInput.domain }],
      },
    });
    if (existing) {
      throw new ActionError("A provider with that id or domain already exists.");
    }

    const result = await auth.api
      .registerSSOProvider({
        headers: await headers(),
        body: {
          providerId: parsedInput.providerId,
          issuer: parsedInput.issuer,
          domain: parsedInput.domain,
          organizationId: ctx.tenant.organizationId,
          oidcConfig: {
            clientId: parsedInput.clientId,
            clientSecret: parsedInput.clientSecret,
            scopes: ["openid", "email", "profile"],
          },
        },
      })
      .catch((err: unknown) => {
        throw new ActionError(
          err instanceof Error ? `Provider registration failed: ${err.message}` : "Failed",
        );
      });
    void result;

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "USER",
        tenantId: ctx.tenant.id,
        action: "sso.provider.registered",
        entityType: "SsoProvider",
        entityId: parsedInput.providerId,
        after: { domain: parsedInput.domain, issuer: parsedInput.issuer },
      },
    });

    revalidatePath(`/org/${ctx.tenant.slug}/settings`);
    return { ok: true };
  });

export const removeOrgSsoProvider = orgOwnerClient
  .inputSchema(z.object({ tenantSlug: slugSchema, providerId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const provider = await db.ssoProvider.findUnique({
      where: { providerId: parsedInput.providerId },
    });
    if (!provider || provider.organizationId !== ctx.tenant.organizationId) {
      throw new ActionError("Provider not found.");
    }
    await db.ssoProvider.delete({ where: { providerId: parsedInput.providerId } });
    revalidatePath(`/org/${ctx.tenant.slug}/settings`);
    return { ok: true };
  });

/** Platform admin: trust toggle enabling domain-based auto-provisioning. */
export const setSsoDomainVerified = adminActionClient
  .inputSchema(z.object({ providerId: z.string().min(1), verified: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    await db.ssoProvider.update({
      where: { providerId: parsedInput.providerId },
      data: { domainVerified: parsedInput.verified },
    });
    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "ADMIN",
        action: parsedInput.verified ? "sso.domain.verified" : "sso.domain.unverified",
        entityType: "SsoProvider",
        entityId: parsedInput.providerId,
      },
    });
    revalidatePath("/admin/sso");
    return { ok: true };
  });
