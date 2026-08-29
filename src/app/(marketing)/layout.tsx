import Link from "next/link";

import { SiteFooter } from "@/components/marketing";
import { HeaderAuth } from "@/components/marketing/header-auth";
import { MobileNav } from "@/components/marketing/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

const NAV = [
  { href: "/courses", label: "Courses" },
  { href: "/projects", label: "Projects" },
  { href: "/pricing", label: "Pricing" },
  { href: "/verify", label: "Verify", accent: true },
  { href: "/onboarding", label: "Teach" },
];

/**
 * This layout deliberately performs NO request-scoped reads (`headers()`,
 * `cookies()`, `searchParams`). It used to `await getSession()` purely to swap
 * one header button, which pinned every page under `(marketing)` to dynamic
 * rendering — see `HeaderAuth` for the measurements. Keep it that way: adding a
 * session or cookie read here silently un-caches the entire public site.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 md:gap-6">
            <MobileNav items={NAV} />
            <Link
              href="/"
              className="text-gradient text-lg font-extrabold tracking-tight"
            >
              {BRAND.name}
            </Link>
            <nav className="hidden items-center gap-4 text-sm font-semibold text-muted-foreground md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    item.accent
                      ? "text-primary-subtle-foreground transition-colors hover:text-primary"
                      : "transition-colors hover:text-primary"
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              render={<Link href="/cart" />}
              variant="ghost"
              size="sm"
              className="rounded-full"
            >
              Cart
            </Button>
            <HeaderAuth />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
