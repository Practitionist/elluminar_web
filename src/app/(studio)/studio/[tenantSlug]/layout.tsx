import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { requireTenantMember } from "@/lib/auth/session";

const NAV = [
  { href: "", label: "Overview" },
  { href: "/courses", label: "Courses" },
  { href: "/projects", label: "Projects" },
  { href: "/cohorts", label: "Cohorts" },
  { href: "/coupons", label: "Coupons" },
  { href: "/earnings", label: "Earnings" },
  { href: "/members", label: "Team" },
  { href: "/settings", label: "Settings" },
];

export default async function StudioTenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r bg-muted/30 md:block">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Link href="/studio" className="truncate font-semibold">
            {tenant.displayName}
          </Link>
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={`/studio/${tenantSlug}${item.href}`}
              className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3">
          <Link
            href={`/c/${tenantSlug}`}
            className="block rounded-md border px-3 py-2 text-center text-sm hover:bg-muted"
          >
            View storefront →
          </Link>
        </div>
      </aside>
      <div className="flex-1">
        {tenant.status !== "APPROVED" && (
          <div className="border-b bg-amber-50 px-6 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <Badge variant="outline" className="mr-2">
              {tenant.status.toLowerCase()}
            </Badge>
            Your school is under review — you can author content now; publishing
            unlocks on approval.
          </div>
        )}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
