"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { probeOidcDiscovery, ssoConnectionUrls } from "@/lib/enterprise/sso";
import { ActionError, adminActionClient, tenantActionClient } from "@/lib/safe-action";
import {
  registerSsoProviderSchema,
  ssoProviderRefSchema,
} from "@/lib/validation/enterprise";

const orgOwnerClient = tenantActionClient(["owner", "admin"]);

/** BetterAuth surfaces IdP/parse failures as plain Errors; keep the detail, drop the stack. */
function ssoError(err: unknown, fallback: string): never {
  throw new ActionError(err instanceof Error ? `${fallback}: ${err.message}` : fallback);
}

/**
 * Registers an OIDC or SAML 2.0 provider for the organization.
 *
 * Providers are registered *unverified*: BetterAuth refuses every sign-in
 * against a provider whose `domainVerified` is false, so a registration alone
 * grants nothing. Ownership of the email domain is proven separately, via the
 * DNS TXT challenge below — which matters because the domain is what decides
 * whose employees get auto-provisioned into this org.
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

    const urls = ssoConnectionUrls(parsedInput.providerId);

    // Fail before we persist: a bad issuer would otherwise produce a row that
    // looks healthy in the console and breaks only at an employee's first login.
    if (parsedInput.protocol === "oidc") {
      const probe = await probeOidcDiscovery(parsedInput.issuer);
      if (!probe.ok) throw new ActionError(probe.reason);
    }

    const body =
      parsedInput.protocol === "oidc"
        ? {
            providerId: parsedInput.providerId,
            issuer: parsedInput.issuer,
            domain: parsedInput.domain,
            organizationId: ctx.tenant.organizationId,
            oidcConfig: {
              clientId: parsedInput.clientId,
              clientSecret: parsedInput.clientSecret,
              scopes: ["openid", "email", "profile"],
              pkce: true,
            },
          }
        : {
            providerId: parsedInput.providerId,
            issuer: parsedInput.issuer,
            domain: parsedInput.domain,
            organizationId: ctx.tenant.organizationId,
            samlConfig: {
              entryPoint: parsedInput.entryPoint,
              cert: parsedInput.cert,
              callbackUrl: urls.acsUrl,
              audience: urls.spEntityId,
              wantAssertionsSigned: parsedInput.wantAssertionsSigned,
              authnRequestsSigned: parsedInput.authnRequestsSigned,
              signatureAlgorithm: parsedInput.signatureAlgorithm,
              digestAlgorithm: parsedInput.digestAlgorithm,
              identifierFormat: parsedInput.identifierFormat,
              spMetadata: {
                entityID: urls.spEntityId,
                binding: "post",
              },
            },
          };

    const result = await auth.api
      .registerSSOProvider({ headers: await headers(), body })
      .catch((err: unknown) => ssoError(err, "Provider registration failed"));

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "USER",
        tenantId: ctx.tenant.id,
        action: "sso.provider.registered",
        entityType: "SsoProvider",
        entityId: parsedInput.providerId,
        after: {
          protocol: parsedInput.protocol,
          domain: parsedInput.domain,
          issuer: parsedInput.issuer,
        },
      },
    });

    revalidatePath(`/org/${ctx.tenant.slug}/settings`);

    // The DNS token is the whole point of registering — without it the admin
    // cannot publish the TXT record and the provider stays permanently inert.
    // (It was previously discarded with `void result`.)
    return {
      providerId: parsedInput.providerId,
      domainVerificationToken:
        (result as { domainVerificationToken?: string }).domainVerificationToken ?? null,
    };
  });

/**
 * Re-issues the DNS challenge token. Safe to call repeatedly — useful when the
 * admin lost the token or the record was removed. BetterAuth rejects this once
 * the domain is already verified, so we translate that into plain language.
 */
export const requestSsoDomainVerification = orgOwnerClient
  .inputSchema(ssoProviderRefSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertProviderBelongsToTenant(parsedInput.providerId, ctx.tenant.organizationId);

    const result = await auth.api
      .requestDomainVerification({
        headers: await headers(),
        body: { providerId: parsedInput.providerId },
      })
      .catch((err: unknown) => ssoError(err, "Could not issue a verification token"));

    revalidatePath(`/org/${ctx.tenant.slug}/settings`);
    return {
      domainVerificationToken:
        (result as { domainVerificationToken?: string }).domainVerificationToken ?? null,
    };
  });

/** Checks the published TXT record and flips `domainVerified` on success. */
export const verifySsoDomain = orgOwnerClient
  .inputSchema(ssoProviderRefSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertProviderBelongsToTenant(parsedInput.providerId, ctx.tenant.organizationId);

    await auth.api
      .verifyDomain({
        headers: await headers(),
        body: { providerId: parsedInput.providerId },
      })
      .catch((err: unknown) =>
        ssoError(
          err,
          "Domain verification failed — DNS changes can take up to an hour to propagate",
        ),
      );

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "USER",
        tenantId: ctx.tenant.id,
        action: "sso.domain.verified",
        entityType: "SsoProvider",
        entityId: parsedInput.providerId,
        after: { method: "dns-txt" },
      },
    });

    revalidatePath(`/org/${ctx.tenant.slug}/settings`);
    revalidatePath("/admin/sso");
    return { ok: true };
  });

export const removeOrgSsoProvider = orgOwnerClient
  .inputSchema(ssoProviderRefSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertProviderBelongsToTenant(parsedInput.providerId, ctx.tenant.organizationId);

    await db.ssoProvider.delete({ where: { providerId: parsedInput.providerId } });

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "USER",
        tenantId: ctx.tenant.id,
        action: "sso.provider.removed",
        entityType: "SsoProvider",
        entityId: parsedInput.providerId,
      },
    });

    revalidatePath(`/org/${ctx.tenant.slug}/settings`);
    revalidatePath("/admin/sso");
    return { ok: true };
  });

async function assertProviderBelongsToTenant(providerId: string, organizationId: string) {
  const provider = await db.ssoProvider.findUnique({ where: { providerId } });
  if (!provider || provider.organizationId !== organizationId) {
    throw new ActionError("Provider not found.");
  }
  return provider;
}

/**
 * Platform-staff override. DNS is the primary path; this exists for the two
 * cases it cannot cover — vouching for a customer whose DNS team is slow
 * (sales-led onboarding), and revoking trust on a provider we no longer trust.
 *
 * Note the asymmetry: BetterAuth's `verifyDomain` throws CONFLICT once
 * `domainVerified` is true, so granting here closes the self-service route.
 * Revoking re-opens it, which is why the copy in /admin/sso says so.
 */
export const setSsoDomainVerified = adminActionClient
  .inputSchema(
    z.object({
      providerId: z.string().min(1),
      verified: z.boolean(),
      reason: z.string().max(500).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const provider = await db.ssoProvider.findUnique({
      where: { providerId: parsedInput.providerId },
    });
    if (!provider) throw new ActionError("Provider not found.");

    await db.ssoProvider.update({
      where: { providerId: parsedInput.providerId },
      data: { domainVerified: parsedInput.verified },
    });

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "ADMIN",
        action: parsedInput.verified
          ? "sso.domain.verified.override"
          : "sso.domain.revoked",
        entityType: "SsoProvider",
        entityId: parsedInput.providerId,
        before: { domainVerified: provider.domainVerified },
        after: { domainVerified: parsedInput.verified, reason: parsedInput.reason ?? null },
      },
    });

    revalidatePath("/admin/sso");
    return { ok: true };
  });
