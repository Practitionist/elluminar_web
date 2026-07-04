import { Bell } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

import { MobileNav } from "./mobile-nav";
import { SidebarContent } from "./sidebar-content";
import type { NavSection, ShellBrand, ShellUser, Surface } from "./types";

export function DashboardShell({
  brand,
  nav,
  surfaces,
  user,
  children,
}: {
  brand: ShellBrand;
  nav: NavSection[];
  surfaces: Surface[];
  user: ShellUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent
            brand={brand}
            nav={nav}
            surfaces={surfaces}
            user={user}
          />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/80 px-4 backdrop-blur">
          <MobileNav brand={brand} nav={nav} surfaces={surfaces} user={user} />
          <span className="font-extrabold tracking-tight md:hidden">
            {brand.label}
          </span>
          <div className="flex-1" />
          <ThemeToggle />
          <Link
            href="/learn/notifications"
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
          </Link>
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary-subtle text-xs font-extrabold text-primary-subtle-foreground">
            {user.initials}
          </span>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
