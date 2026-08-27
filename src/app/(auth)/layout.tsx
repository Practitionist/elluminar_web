import Link from "next/link";

import { AuthBrandPanel } from "@/components/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AuthBrandPanel />

      <main className="relative flex flex-1 flex-col">
        {/* Damped to opacity-40: every marketing section damps the mesh, and at
            full strength behind a form it competes with the input borders. */}
        <div className="gradient-mesh pointer-events-none absolute inset-0 opacity-40 lg:opacity-25" />

        <div className="relative flex items-center justify-between px-6 py-6 lg:justify-end">
          {/* The wordmark is the brand panel's job on large screens. */}
          <Link
            href="/"
            className="text-gradient text-xl font-extrabold tracking-tight lg:hidden"
          >
            {BRAND.name}
          </Link>
          <ThemeToggle />
        </div>

        <div className="relative flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>
      </main>
    </div>
  );
}
