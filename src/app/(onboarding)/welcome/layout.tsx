import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND } from "@/lib/brand";

/**
 * Deliberately not the dashboard shell. A first-run flow with a sidebar full
 * of surfaces the user hasn't earned yet reads as a form they can ignore;
 * without it, it reads as the one thing on screen.
 */
export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="gradient-mesh pointer-events-none absolute inset-0 opacity-30" />

      <header className="relative flex items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="text-gradient text-xl font-extrabold tracking-tight"
        >
          {BRAND.name}
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative flex flex-1 justify-center px-6 pb-16">
        <div className="w-full max-w-xl">{children}</div>
      </main>
    </div>
  );
}
