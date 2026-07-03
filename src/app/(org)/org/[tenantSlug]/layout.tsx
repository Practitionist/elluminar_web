import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { requireTenantMember } from "@/lib/auth/session";
import { tenantLabels } from "@/lib/enterprise/labels";

export default async function OrgPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant, membership } = await requireTenantMember(tenantSlug);

  if (tenant.type !== "ENTERPRISE" && tenant.type !== "UNIVERSITY") {
    redirect(`/studio/${tenantSlug}`);
  }
  const labels = tenantLabels(tenant.type);
  const isOrgAdmin =
    !membership || ["owner", "admin"].some((r) => membership.role.split(",").includes(r));

  const nav = [
    { href: "", label: "Overview" },
    ...(isOrgAdmin
      ? [
          { href: "/licenses", label: "Licenses" },
          { href: "/roster", label: labels.members },
          { href: "/programs", label: "Programs" },
          { href: "/reports", label: "Reports" },
          { href: "/settings", label: "Settings" },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r bg-muted/30 md:block">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Link href={`/org/${tenantSlug}`} className="truncate font-semibold">
            {tenant.displayName}
          </Link>
        </div>
        <div className="px-4 pt-3">
          <Badge variant="outline">{labels.org.toLowerCase()} portal</Badge>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={`/org/${tenantSlug}${item.href}`}
              className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 p-3">
          <Link
            href={`/c/${tenantSlug}`}
            className="block rounded-md border px-3 py-2 text-center text-sm hover:bg-muted"
          >
            Public page →
          </Link>
          <Link
            href="/learn"
            className="block rounded-md border px-3 py-2 text-center text-sm hover:bg-muted"
          >
            My learning →
          </Link>
        </div>
      </aside>
      <div className="flex-1">
        {tenant.status !== "APPROVED" && (
          <div className="border-b bg-amber-50 px-6 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <Badge variant="outline" className="mr-2">
              {tenant.status.toLowerCase()}
            </Badge>
            Your {labels.org.toLowerCase()} is under review — licensing and
            programs unlock on approval.
          </div>
        )}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
