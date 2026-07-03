import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-bold tracking-tight text-gradient">
              lms-web
            </Link>
            <nav className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
              <Link href="/courses" className="transition-colors hover:text-primary">
                Courses
              </Link>
              <Link href="/projects" className="transition-colors hover:text-primary">
                Projects
              </Link>
              <Link href="/pricing" className="transition-colors hover:text-primary">
                Pricing
              </Link>
              <Link href="/onboarding" className="transition-colors hover:text-primary">
                Teach
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button render={<Link href="/cart" />} variant="ghost" size="sm" className="rounded-full">
              Cart
            </Button>
            {session ? (
              <Button
                render={<Link href="/learn" />}
                size="sm"
                className="rounded-full px-4 shadow-md hover:shadow-lg transition-all"
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button render={<Link href="/sign-in" />} variant="ghost" size="sm" className="rounded-full">
                  Sign in
                </Button>
                <Button
                  render={<Link href="/sign-up" />}
                  size="sm"
                  className="rounded-full px-4 shadow-md hover:shadow-lg transition-all"
                >
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/50">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} lms-web · Learn by building, verified by mentors.</p>
          <div className="flex gap-4">
            <Link href="/verify" className="transition-colors hover:text-primary">
              Verify a certificate
            </Link>
            <Link href="/onboarding" className="transition-colors hover:text-primary">
              Become a creator
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
