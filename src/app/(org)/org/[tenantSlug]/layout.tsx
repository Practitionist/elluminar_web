import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { NavItem, NavSection } from "@/components/dashboard/types";
import { Pill } from "@/components/shared";
import { requireOrgTenant } from "@/lib/auth/session";
import { tenantLabels } from "@/lib/enterprise/labels";
import { getAccessibleSurfaces, toShellUser } from "@/lib/nav/surfaces";

export default async function OrgPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  // requireOrgTenant enforces ENTERPRISE/UNIVERSITY (and honours the platform
  // admin / preview-deploy overrides), so the layout no longer re-checks the
  // type itself — one guard, one place, same rule as every /org page.
  const { session, tenant, membership } = await requireOrgTenant(tenantSlug);

  const labels = tenantLabels(tenant.type);
  const isOrgAdmin =
    !membership ||
    ["owner", "admin"].some((r) => membership.role.split(",").includes(r));
  const base = `/org/${tenantSlug}`;
  const surfaces = await getAccessibleSurfaces(session);

  const adminItems: NavItem[] = isOrgAdmin
    ? [
        { href: `${base}/licenses`, label: "Licenses", icon: "licenses" },
        { href: `${base}/roster`, label: labels.members, icon: "roster" },
        { href: `${base}/programs`, label: "Programs", icon: "programs" },
        { href: `${base}/reports`, label: "Reports", icon: "reports" },
        { href: `${base}/settings`, label: "Settings", icon: "settings" },
      ]
    : [];

  const nav: NavSection[] = [
    {
      items: [
        { href: base, label: "Overview", icon: "overview", exact: true },
        ...adminItems,
      ],
    },
    {
      label: "Public",
      items: [
        { href: `/c/${tenantSlug}`, label: "Public page", icon: "storefront" },
      ],
    },
  ];

  return (
    <DashboardShell
      brand={{
        label: tenant.displayName,
        sublabel: `${labels.org} portal`,
        href: base,
      }}
      nav={nav}
      surfaces={surfaces}
      user={toShellUser(session.user)}
    >
      {tenant.status !== "APPROVED" ? (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-distinction/20 bg-distinction-subtle px-4 py-2.5 text-sm text-distinction-subtle-foreground">
          <Pill tone="distinction" className="px-2 py-0.5 text-[10px]">
            {tenant.status.toLowerCase()}
          </Pill>
          Your {labels.org.toLowerCase()} is under review — licensing and
          programs unlock on approval.
        </div>
      ) : null}
      {children}
    </DashboardShell>
  );
}
