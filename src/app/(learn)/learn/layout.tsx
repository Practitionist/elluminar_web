import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";

const NAV = [
  { href: "/learn", label: "Dashboard" },
  { href: "/learn/projects", label: "My projects" },
  { href: "/learn/orders", label: "Orders" },
  { href: "/billing", label: "Billing" },
];

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/learn");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight">
              lms-web
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button render={<Link href="/courses" />} variant="ghost" size="sm">
              Browse
            </Button>
            <Button render={<Link href="/cart" />} variant="outline" size="sm">
              Cart
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
