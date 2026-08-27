import { cn } from "@/lib/utils";

/** One titled card per concern, so every /account page reads the same way. */
export function AccountSection({
  title,
  description,
  footer,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn("rounded-2xl border border-border bg-card p-6", className)}
    >
      <h2 className="font-display text-lg font-medium tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
      {footer ? (
        <div className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

export function AccountPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </header>
  );
}
