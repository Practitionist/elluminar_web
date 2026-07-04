import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { NavSection } from "@/components/dashboard/types";
import { Pill } from "@/components/shared";
import { requireTenantMember } from "@/lib/auth/session";
import { getAccessibleSurfaces, toShellUser } from "@/lib/nav/surfaces";

export default async function StudioTenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { session, tenant } = await requireTenantMember(tenantSlug);
  const surfaces = await getAccessibleSurfaces(session);
  const base = `/studio/${tenantSlug}`;

  const nav: NavSection[] = [
    {
      items: [
        { href: base, label: "Overview", icon: "overview", exact: true },
        { href: `${base}/courses`, label: "Courses", icon: "courses" },
        { href: `${base}/projects`, label: "Projects", icon: "projects" },
        { href: `${base}/cohorts`, label: "Cohorts", icon: "cohorts" },
        { href: `${base}/coupons`, label: "Coupons", icon: "coupons" },
        { href: `${base}/earnings`, label: "Earnings", icon: "earnings" },
        { href: `${base}/members`, label: "Team", icon: "members" },
        { href: `${base}/settings`, label: "Settings", icon: "settings" },
      ],
    },
    {
      label: "Public",
      items: [
        {
          href: `/c/${tenantSlug}`,
          label: "View storefront",
          icon: "storefront",
        },
      ],
    },
  ];

  return (
    <DashboardShell
      brand={{
        label: tenant.displayName,
        sublabel: "Creator studio",
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
          Your school is under review — you can author content now; publishing
          unlocks on approval.
        </div>
      ) : null}
      {children}
    </DashboardShell>
  );
}
