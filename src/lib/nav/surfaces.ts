import { isPlatformAdmin as isAdminRole } from "@/lib/auth/roles";
import "server-only";

import { cache } from "react";

import type { ShellUser, Surface } from "@/components/dashboard/types";
import { db } from "@/lib/db";
import { showAllSurfaces } from "@/lib/deploy-context";

type SessionLike = { user: { id: string; role?: string | null } };

/**
 * The set of dashboard surfaces a user can reach — powers the sidebar switcher
 * so no surface is orphaned. Platform admins see everything; others see only
 * the surfaces their memberships/role grant.
 */
export const getAccessibleSurfaces = cache(
  async (session: SessionLike): Promise<Surface[]> => {
    const userId = session.user.id;
    // On preview deploys every surface is listed, so the whole product can be
    // reviewed from one login. Production lists only what the user really has.
    const isAdmin = isAdminRole(session.user.role) || showAllSurfaces();

    const surfaces: Surface[] = [
      { href: "/learn", label: "Learning", icon: "home" },
    ];

    const memberships = await db.member.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);
    const tenants = orgIds.length
      ? await db.tenant.findMany({
          where: { organizationId: { in: orgIds } },
          select: { slug: true, type: true },
        })
      : [];
    const hasCreator = tenants.some((t) => t.type === "CREATOR");
    let orgTenant = tenants.find(
      (t) => t.type === "ENTERPRISE" || t.type === "UNIVERSITY",
    ) as { slug: string; type: string } | undefined;

    const mentor = await db.mentorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (hasCreator) {
      surfaces.push({ href: "/studio", label: "Creator studio", icon: "studio" });
    } else if (isAdmin) {
      const t = await db.tenant.findFirst({
        where: { type: "CREATOR", status: "APPROVED" },
        select: { slug: true },
      });
      surfaces.push({
        href: t ? `/studio/${t.slug}` : "/studio",
        label: "Creator studio",
        icon: "studio",
      });
    }
    if (mentor || isAdmin)
      surfaces.push({ href: "/mentor", label: "Mentor desk", icon: "mentor" });

    if (!orgTenant && isAdmin) {
      orgTenant =
        (await db.tenant.findFirst({
          where: {
            type: { in: ["ENTERPRISE", "UNIVERSITY"] },
            status: "APPROVED",
          },
          select: { slug: true, type: true },
        })) ?? undefined;
    }
    if (orgTenant)
      surfaces.push({
        href: `/org/${orgTenant.slug}`,
        label: "Org portal",
        icon: "org",
      });

    if (isAdmin)
      surfaces.push({ href: "/admin", label: "Platform admin", icon: "admin" });

    return surfaces;
  },
);

export function toShellUser(user: {
  name?: string | null;
  email?: string | null;
}): ShellUser {
  const name = user.name ?? null;
  const initials =
    (name ?? user.email ?? "?")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "U";
  return { name, email: user.email ?? null, initials };
}
