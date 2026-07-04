import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { NavSection } from "@/components/dashboard/types";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { getAccessibleSurfaces, toShellUser } from "@/lib/nav/surfaces";

const NAV: NavSection[] = [
  {
    items: [
      { href: "/admin", label: "Dashboard", icon: "gauge", exact: true },
      { href: "/admin/tenants", label: "Tenant approvals", icon: "tenants" },
      { href: "/admin/mentors", label: "Mentor vetting", icon: "mentor" },
      { href: "/admin/moderation", label: "Moderation", icon: "moderation" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "orders" },
      { href: "/admin/refunds", label: "Refunds", icon: "refunds" },
      { href: "/admin/payouts", label: "Payouts", icon: "payouts" },
      { href: "/admin/coupons", label: "Coupons", icon: "coupons" },
    ],
  },
  {
    label: "Enterprise",
    items: [
      { href: "/admin/licenses", label: "Licenses", icon: "licenses" },
      { href: "/admin/sso", label: "SSO providers", icon: "sso" },
      { href: "/admin/flags", label: "Feature flags", icon: "flags" },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePlatformAdmin();
  const surfaces = await getAccessibleSurfaces(session);
  return (
    <DashboardShell
      brand={{ label: "Platform admin", sublabel: BRAND.name, href: "/admin" }}
      nav={NAV}
      surfaces={surfaces}
      user={toShellUser(session.user)}
    >
      {children}
    </DashboardShell>
  );
}
