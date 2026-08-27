import { isPlatformAdmin as isAdminRole } from "@/lib/auth/roles";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { canAccessTenantType, STUDIO_TENANT_TYPES, tenantHomePath } from "@/lib/auth/tenant-access";
import { db } from "@/lib/db";
import { showAllSurfaces } from "@/lib/deploy-context";

export const metadata = { title: "Studio" };

export default async function StudioIndexPage() {
  const session = await requireUser("/studio");

  const memberships = await db.member.findMany({
    where: { userId: session.user.id },
    select: {
      role: true,
      organization: {
        select: { tenant: { select: { slug: true, displayName: true, status: true, type: true } } },
      },
    },
  });
  const tenants = memberships
    .map((m) => ({ role: m.role, tenant: m.organization.tenant }))
    .filter((t): t is { role: string; tenant: NonNullable<typeof t.tenant> } => !!t.tenant);

  // The studio switcher must only ever offer CREATOR tenants — this page is the
  // path that reproduced #47: an org-only member landed here and was bounced
  // straight into `/studio/<their-slug>` because the single-tenant shortcut
  // never looked at Tenant.type.
  const isPlatformAdmin = isAdminRole(session.user.role);
  const previewMode = showAllSurfaces();
  const creatorTenants = tenants.filter((t) =>
    canAccessTenantType({
      tenantType: t.tenant.type,
      allowedTypes: STUDIO_TENANT_TYPES,
      isPlatformAdmin,
      previewMode,
    }),
  );

  if (creatorTenants.length === 0) {
    // No school of their own: send org members to their portal, everyone else
    // to onboarding, rather than dead-ending on an empty studio.
    const elsewhere = tenants[0];
    redirect(
      elsewhere ? tenantHomePath(elsewhere.tenant.slug, elsewhere.tenant.type) : "/onboarding",
    );
  }
  if (creatorTenants.length === 1) redirect(`/studio/${creatorTenants[0].tenant.slug}`);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        Your schools
      </h1>
      <div className="mt-6 grid gap-4">
        {creatorTenants.map(({ role, tenant }) => (
          <Link
            key={tenant.slug}
            href={`/studio/${tenant.slug}`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-muted/50"
          >
            <div>
              <div className="text-base font-extrabold">{tenant.displayName}</div>
              <div className="mt-1 text-xs font-semibold text-muted-foreground">
                /c/{tenant.slug}
              </div>
            </div>
            <div className="flex gap-2">
              <Pill tone="neutral">{role}</Pill>
              <Pill tone={tenant.status === "APPROVED" ? "success" : "distinction"}>
                {tenant.status.toLowerCase()}
              </Pill>
            </div>
          </Link>
        ))}
      </div>
      <Button
        render={<Link href="/onboarding" />}
        variant="outline"
        className="mt-6 rounded-full"
      >
        Create another school
      </Button>
    </div>
  );
}
