"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { NavIcon } from "./icon-map";
import { SignOutButton } from "./sign-out-button";
import type { NavSection, ShellBrand, ShellUser, Surface } from "./types";

export function SidebarContent({
  brand,
  nav,
  surfaces,
  user,
  onNavigate,
}: {
  brand: ShellBrand;
  nav: NavSection[];
  surfaces: Surface[];
  user: ShellUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <Link
          href={brand.href}
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2"
        >
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
            ✓
          </span>
          <span className="min-w-0">
            <span className="block truncate font-extrabold tracking-tight">
              {brand.label}
            </span>
            {brand.sublabel ? (
              <span className="block truncate text-[11px] font-semibold text-muted-foreground">
                {brand.sublabel}
              </span>
            ) : null}
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {nav.map((section, si) => (
          <div key={si} className="space-y-1">
            {section.label ? (
              <div className="px-3 pb-1 text-[10px] font-extrabold tracking-wider text-muted-foreground/70 uppercase">
                {section.label}
              </div>
            ) : null}
            {section.items.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-primary-subtle text-primary-subtle-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <NavIcon name={item.icon} className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge != null ? (
                    <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] font-bold">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-3 border-t border-border p-3">
        {surfaces.length > 1 ? (
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-extrabold tracking-wider text-muted-foreground/70 uppercase">
              Switch to
            </div>
            {surfaces.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                onClick={onNavigate}
                className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <NavIcon name={s.icon} className="size-4 shrink-0" />
                <span className="truncate">{s.label}</span>
              </Link>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-2.5 px-1">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-extrabold text-primary-subtle-foreground">
            {user.initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">
              {user.name ?? "Account"}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {user.email}
            </div>
          </div>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
