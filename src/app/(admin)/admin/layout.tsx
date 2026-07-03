import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/auth/session";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/tenants", label: "Tenant approvals" },
  { href: "/admin/mentors", label: "Mentor vetting" },
  { href: "/admin/moderation", label: "Catalog moderation" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/refunds", label: "Refunds" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/flags", label: "Feature flags" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r bg-muted/30 md:block">
        <div className="flex h-14 items-center border-b px-4 font-semibold">
          Platform admin
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
