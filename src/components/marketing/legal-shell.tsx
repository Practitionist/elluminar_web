import Link from "next/link";

/**
 * Shared chrome for legal/policy pages (/terms, /privacy, /refund-policy, /contact).
 * Content is drafted to mirror implemented product behavior; counsel review is
 * tracked in issue #36 before public launch.
 */
export function LegalShell({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <p className="text-sm font-bold tracking-wide text-primary uppercase">
        Legal
      </p>
      <h1 className="font-display mt-2 text-4xl font-medium tracking-tight md:text-5xl">
        {title}
      </h1>
      <p className="text-muted-foreground mt-3 text-sm">
        Effective {effectiveDate} ·{" "}
        <Link href="/contact" className="underline underline-offset-4">
          Questions? Contact us
        </Link>
      </p>
      <div className="mt-10 space-y-8">{children}</div>
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl font-medium tracking-tight">
        {heading}
      </h2>
      <div className="text-muted-foreground space-y-3 text-[15px] leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}
