import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { NavSection } from "@/components/dashboard/types";
import { requireUser } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { getAccessibleSurfaces, toShellUser } from "@/lib/nav/surfaces";

const NAV: NavSection[] = [
  {
    items: [
      { href: "/learn", label: "Home", icon: "home", exact: true },
      { href: "/learn/projects", label: "My projects", icon: "projects" },
      { href: "/learn/programs", label: "My programs", icon: "programs" },
      { href: "/learn/community", label: "Community", icon: "community" },
      { href: "/learn/org", label: "Org benefits", icon: "org" },
      { href: "/learn/orders", label: "Orders", icon: "orders" },
      {
        href: "/learn/notifications",
        label: "Notifications",
        icon: "notifications",
      },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/billing", label: "Billing", icon: "billing" },
      { href: "/courses", label: "Browse catalog", icon: "library" },
    ],
  },
];

export default async function LearnGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser("/learn");
  const surfaces = await getAccessibleSurfaces(session);
  return (
    <DashboardShell
      brand={{ label: BRAND.name, sublabel: "Learning", href: "/learn" }}
      nav={NAV}
      surfaces={surfaces}
      user={toShellUser(session.user)}
    >
      {children}
    </DashboardShell>
  );
}
