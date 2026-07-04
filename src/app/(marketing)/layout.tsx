import Link from "next/link";

import { SiteFooter } from "@/components/marketing";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";

const NAV = [
  { href: "/courses", label: "Courses" },
  { href: "/projects", label: "Projects" },
  { href: "/pricing", label: "Pricing" },
  { href: "/verify", label: "Verify", accent: true },
  { href: "/onboarding", label: "Teach" },
];

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
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
                      ? "text-primary transition-colors hover:text-primary/80"
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
            {session ? (
              <Button
                render={<Link href="/learn" />}
                size="sm"
                className="rounded-full px-4 shadow-md transition-all hover:shadow-lg"
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button
                  render={<Link href="/sign-in" />}
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                >
                  Sign in
                </Button>
                <Button
                  render={<Link href="/sign-up" />}
                  size="sm"
                  className="rounded-full px-4 shadow-md transition-all hover:shadow-lg"
                >
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
