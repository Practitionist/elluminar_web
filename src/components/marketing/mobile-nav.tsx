"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type MobileNavItem = { href: string; label: string; accent?: boolean };

/**
 * Marketing nav for viewports below `md`, where the horizontal nav is hidden.
 * Without this the catalog, pricing and credential-verification pages are
 * unreachable from the header on a phone — footer links were the only route.
 */
export function MobileNav({
  items,
  signedIn,
}: {
  items: readonly MobileNavItem[];
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </Button>
        }
      />
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4 pb-6">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-base font-semibold transition-colors",
                  active
                    ? "bg-primary-subtle text-primary-subtle-foreground"
                    : "text-foreground hover:bg-muted",
                  item.accent && !active && "text-primary-subtle-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
            {signedIn ? (
              <Button
                render={<Link href="/learn" onClick={() => setOpen(false)} />}
                className="rounded-full"
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button
                  render={<Link href="/sign-in" onClick={() => setOpen(false)} />}
                  variant="outline"
                  className="rounded-full"
                >
                  Sign in
                </Button>
                <Button
                  render={<Link href="/sign-up" onClick={() => setOpen(false)} />}
                  className="rounded-full"
                >
                  Get started
                </Button>
              </>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
