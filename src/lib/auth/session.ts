import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import type { PlatformRole } from "@/lib/auth/permissions";
import { db } from "@/lib/db";

/**
 * DEV-ONLY escape hatch: when `DEV_DISABLE_AUTH=true` (and NOT production),
 * every session resolves to a seeded user with role forced to "admin", so all
 * guards pass and the entire UI is browsable without signing in. Impersonates
 * `DEV_AUTH_EMAIL` if set, else the oldest seeded user. Never active in prod.
 */
const DEV_AUTH_BYPASS =
  process.env.NODE_ENV !== "production" &&
  process.env.DEV_DISABLE_AUTH === "true";

async function devBypassSession() {
  const email = process.env.DEV_AUTH_EMAIL;
  const user = email
    ? await db.user.findFirst({ where: { email } })
    : await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) return null;
  const now = new Date();
  return {
    session: {
      id: "dev-bypass",
      token: "dev-bypass",
      userId: user.id,
      expiresAt: new Date(now.getTime() + 86_400_000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
    },
    user: { ...user, role: "admin" },
  } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>;
}

/** Request-scoped session lookup (deduped across a render pass). */
export const getSession = cache(async () => {
  if (DEV_AUTH_BYPASS) {
    const dev = await devBypassSession();
    if (dev) return dev;
  }
  return auth.api.getSession({ headers: await headers() });
});

export async function requireUser(redirectTo?: string) {
  const session = await getSession();
  if (!session) {
    const target = redirectTo ? `/sign-in?next=${encodeURIComponent(redirectTo)}` : "/sign-in";
    redirect(target);
  }
  return session;
}

/** Platform staff gate (User.role via the admin plugin). */
export async function requirePlatformRole(...roles: PlatformRole[]) {
  const session = await requireUser();
  const role = (session.user.role ?? "user") as PlatformRole;
  if (!roles.includes(role)) redirect("/");
  return session;
}

export const requirePlatformAdmin = () => requirePlatformRole("admin");

/**
 * Tenant membership gate: resolves the tenant by slug and asserts the current
 * user is a member of its organization (optionally with one of the given roles).
 */
export async function requireTenantMember(
  tenantSlug: string,
  allowedRoles?: Array<"owner" | "admin" | "instructor" | "member">,
) {
  const session = await requireUser();
  const tenant = await db.tenant.findUnique({
    where: { slug: tenantSlug },
    include: { organization: { select: { id: true } } },
  });
  if (!tenant) redirect("/studio");
  const membership = await db.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId: tenant.organizationId,
        userId: session.user.id,
      },
    },
  });
  const isPlatformAdmin = (session.user.role ?? "user") === "admin";
  if (!membership && !isPlatformAdmin) redirect("/studio");
  if (
    membership &&
    allowedRoles &&
    !allowedRoles.some((r) => membership.role.split(",").includes(r)) &&
    !isPlatformAdmin
  ) {
    redirect(`/studio/${tenantSlug}`);
  }
  return { session, tenant, membership };
}

/** Fine-grained org permission check via BetterAuth's access control. */
export async function hasOrgPermission(
  organizationId: string,
  permissions: Record<string, string[]>,
) {
  const result = await auth.api.hasPermission({
    headers: await headers(),
    body: {
      organizationId,
      permissions: permissions as never,
    },
  });
  return result.success;
}
