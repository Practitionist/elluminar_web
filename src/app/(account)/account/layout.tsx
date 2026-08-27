import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { NavSection } from "@/components/dashboard/types";
import { requireUser } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { getAccessibleSurfaces, toShellUser } from "@/lib/nav/surfaces";

/**
 * `/account` was listed in proxy.ts's PROTECTED_PREFIXES from the start, but no
 * route ever existed behind it — the guard protected a 404. This is that route.
 */
const NAV: NavSection[] = [
  {
    label: "Account",
    items: [
      { href: "/account", label: "Profile", icon: "profile", exact: true },
      { href: "/account/security", label: "Security", icon: "settings" },
      { href: "/account/sessions", label: "Devices", icon: "members" },
      {
        href: "/account/notifications",
        label: "Notifications",
        icon: "notifications",
      },
    ],
  },
  {
    items: [
      { href: "/learn", label: "Back to learning", icon: "home" },
      { href: "/billing", label: "Billing", icon: "billing" },
    ],
  },
];

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser("/account");
  const surfaces = await getAccessibleSurfaces(session);

  return (
    <DashboardShell
      brand={{ label: BRAND.name, sublabel: "Account", href: "/account" }}
      nav={NAV}
      surfaces={surfaces}
      user={toShellUser(session.user)}
    >
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </DashboardShell>
  );
}
