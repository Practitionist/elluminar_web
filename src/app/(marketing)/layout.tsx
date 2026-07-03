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
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight">
              lms-web
            </Link>
            <nav className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
              <Link href="/courses" className="hover:text-foreground">
                Courses
              </Link>
              <Link href="/projects" className="hover:text-foreground">
                Projects
              </Link>
              <Link href="/pricing" className="hover:text-foreground">
                Pricing
              </Link>
              <Link href="/onboarding" className="hover:text-foreground">
                Teach
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button render={<Link href="/cart" />} variant="ghost" size="sm">Cart</Button>
            {session ? (
              <Button render={<Link href="/learn" />} size="sm">Dashboard</Button>
            ) : (
              <>
                <Button render={<Link href="/sign-in" />} variant="ghost" size="sm">Sign in</Button>
                <Button render={<Link href="/sign-up" />} size="sm">Get started</Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} lms-web · Learn by building, verified by mentors.</p>
          <div className="flex gap-4">
            <Link href="/verify" className="hover:text-foreground">
              Verify a certificate
            </Link>
            <Link href="/onboarding" className="hover:text-foreground">
              Become a creator
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
