import * as Sentry from "@sentry/nextjs";
import { createSafeActionClient } from "next-safe-action";

import type { TenantType } from "@/generated/prisma/enums";
import { CONTENT_TEAM_ROLES, type OrgRole } from "@/lib/auth/roles";
import { getSession, requireTenantMember } from "@/lib/auth/session";
import { ORG_TENANT_TYPES, STUDIO_TENANT_TYPES } from "@/lib/auth/tenant-access";

export class ActionError extends Error {}

/** Base client: returns ActionError messages verbatim, masks everything else. */
export const actionClient = createSafeActionClient({
  handleServerError(e) {
    if (e instanceof ActionError) return e.message;
    console.error("[action]", e);
    Sentry.captureException(e);
    return "Something went wrong. Please try again.";
  },
});

/** Requires a signed-in user; exposes { session } in ctx. */
export const authActionClient = actionClient.use(async ({ next }) => {
  const session = await getSession();
  if (!session) throw new ActionError("You must be signed in.");
  Sentry.setUser({ id: session.user.id });
  return next({ ctx: { session } });
});

/** Platform staff only. */
export const adminActionClient = authActionClient.use(async ({ next, ctx }) => {
  const role = ctx.session.user.role ?? "user";
  if (role !== "admin") throw new ActionError("Admin access required.");
  return next({ ctx });
});

/**
 * Binds an action to a tenant the caller belongs to. The action's input must
 * include { tenantSlug }; ctx gains { tenant, membership }.
 *
 * `allowedTypes` gates the tenant's *surface* (see lib/auth/tenant-access).
 * Guarding only the page would repeat the #67 mistake: server actions are
 * their own entry point and are callable without ever rendering the page, so
 * a UNIVERSITY owner could POST `createCourse` at a route guard they never
 * loaded. Prefer `studioActionClient` / `orgActionClient` below.
 */
export function tenantActionClient(
  allowedRoles: readonly OrgRole[] = CONTENT_TEAM_ROLES,
  allowedTypes?: readonly TenantType[],
) {
  return authActionClient.use(async ({ next, clientInput }) => {
    const tenantSlug = (clientInput as { tenantSlug?: string })?.tenantSlug;
    if (!tenantSlug) throw new ActionError("Missing tenant.");
    const { session, tenant, membership } = await requireTenantMember(
      tenantSlug,
      allowedRoles,
      allowedTypes,
    );
    return next({ ctx: { session, tenant, membership } });
  });
}

/** Creator-studio actions — CREATOR tenants only. */
export function studioActionClient(allowedRoles: readonly OrgRole[] = CONTENT_TEAM_ROLES) {
  return tenantActionClient(allowedRoles, STUDIO_TENANT_TYPES);
}

/**
 * Org-portal actions — ENTERPRISE/UNIVERSITY tenants only.
 *
 * `allowedRoles` is required rather than defaulted: org-portal work is licenses,
 * rosters and SSO, so the content-team default that suits the studio would
 * quietly hand `instructor` the keys. Every caller states its own roles.
 */
export function orgActionClient(allowedRoles: readonly OrgRole[]) {
  return tenantActionClient(allowedRoles, ORG_TENANT_TYPES);
}
