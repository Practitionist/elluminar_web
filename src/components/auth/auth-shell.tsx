import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The left-hand brand panel. Reuses the exact treatment already proven in the
 * marketing footer (`gradient-primary` + `.noise`) and the ink band's blurred
 * orbs, so auth reads as the same product rather than a bolted-on login screen.
 *
 * Hidden below `lg` — on a phone the form is the only thing worth the viewport.
 */
export function AuthBrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden text-white lg:flex lg:w-[44%] lg:max-w-2xl lg:flex-col lg:justify-between">
      <div className="gradient-primary absolute inset-0" />
      <div className="noise absolute inset-0" />
      {/* Orbs, matching features-section.tsx — depth without another asset. */}
      <div className="pointer-events-none absolute -top-16 -left-16 size-80 rounded-full bg-white/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 size-80 rounded-full bg-purple-600/30 blur-3xl" />

      <div className="relative p-12">
        <Link
          href="/"
          className="text-2xl font-extrabold tracking-tight text-white"
        >
          {BRAND.name}
        </Link>
      </div>

      <div className="relative max-w-md p-12">
        <h2 className="font-display text-4xl leading-[1.08] font-medium tracking-tight text-balance">
          A résumé says you can.
          <br />A <span className="italic">proof</span> shows you did.
        </h2>
        <p className="mt-5 leading-relaxed text-white/85">
          Courses, live cohorts, and mentor-reviewed projects — buy exactly what
          you need, and leave with work someone senior actually signed off on.
        </p>
        <Separator className="my-8 bg-white/20" />
        <dl className="grid grid-cols-2 gap-6">
          <div>
            <dt className="text-2xl font-extrabold">Mentor-reviewed</dt>
            <dd className="mt-1 text-sm text-white/75">
              Every project read by a practitioner, not a rubric bot.
            </dd>
          </div>
          <div>
            <dt className="text-2xl font-extrabold">Verifiable</dt>
            <dd className="mt-1 text-sm text-white/75">
              Credentials anyone can check, without taking your word for it.
            </dd>
          </div>
        </dl>
      </div>

      <div className="relative p-12 pt-0 text-sm text-white/60">
        {BRAND.tagline}
      </div>
    </aside>
  );
}

/**
 * The form column's heading. Kept as a component so all seven auth pages share
 * one typographic scale — they previously repeated the same class string and
 * had already begun to drift.
 */
export function AuthHeader({
  title,
  description,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <h1 className="font-display text-3xl font-medium tracking-tight text-balance">
        {title}
      </h1>
      {description ? (
        <p className="leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <Separator className="flex-1" />
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}
