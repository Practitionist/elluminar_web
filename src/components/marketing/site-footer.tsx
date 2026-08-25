import type { ReactNode } from "react";
import Link from "next/link";

import { CookieSettingsLink } from "@/components/cookie-consent";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

const COLUMNS: { title: string; links: [string, string][]; extra?: ReactNode }[] = [
  {
    title: "Product",
    links: [
      ["Courses", "/courses"],
      ["Projects", "/projects"],
      ["Pricing", "/pricing"],
      ["Verify a credential", "/verify"],
    ],
  },
  {
    title: "Company",
    links: [
      ["Become a creator", "/onboarding"],
      ["Contact us", "/contact"],
      ["Sign in", "/sign-in"],
      ["Get started", "/sign-up"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Refund policy", "/refund-policy"],
    ],
    extra: <CookieSettingsLink />,
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto overflow-hidden text-white">
      <div className="gradient-primary absolute inset-0" />
      <div className="noise absolute inset-0" />
      <div className="relative container px-4 md:px-6">
        {/* Closing CTA */}
        <div className="flex flex-col items-center gap-6 border-b border-white/15 py-12 text-center md:flex-row md:justify-between md:text-left">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
              Ready to prove it?
            </h2>
            <p className="mt-2 text-white/85">
              Your first course is free. Your first credential is closer than
              you think.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              render={<Link href="/sign-up" />}
              size="lg"
              className="rounded-full bg-white px-7 font-bold text-primary hover:bg-white/90"
            >
              Start learning free
            </Button>
            <Button
              render={<Link href="/verify" />}
              size="lg"
              variant="outline"
              className="rounded-full border-white/50 bg-transparent px-7 font-bold text-white hover:bg-white/10 hover:text-white"
            >
              Verify a credential
            </Button>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid gap-8 py-12 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-3">
            <div className="text-xl font-extrabold tracking-tight">
              {BRAND.name}
            </div>
            <p className="max-w-xs text-sm text-white/80">
              Proof over promise. Learn, build, and earn credentials the world
              can verify.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="mb-3 text-sm font-extrabold">{col.title}</div>
              <ul className="space-y-2.5 text-sm text-white/80">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="transition-colors hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
                {col.extra ? <li>{col.extra}</li> : null}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-2 border-t border-white/15 py-6 text-sm text-white/75 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {BRAND.name} · {BRAND.tagline}
          </p>
          <p>UPI · Cards · EMI · Netbanking · Made in India 🇮🇳</p>
        </div>
      </div>
    </footer>
  );
}
