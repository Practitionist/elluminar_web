import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { NavSection } from "@/components/dashboard/types";
import { requireUser } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { getAccessibleSurfaces, toShellUser } from "@/lib/nav/surfaces";

const NAV: NavSection[] = [
  {
    items: [
      { href: "/mentor", label: "Review queue", icon: "mentor", exact: true },
    ],
  },
];

export default async function MentorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser("/mentor");
  const surfaces = await getAccessibleSurfaces(session);
  return (
    <DashboardShell
      brand={{ label: BRAND.name, sublabel: "Mentor desk", href: "/mentor" }}
      nav={NAV}
      surfaces={surfaces}
      user={toShellUser(session.user)}
    >
      {children}
    </DashboardShell>
  );
}
