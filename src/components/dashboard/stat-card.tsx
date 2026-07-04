import { PILL_TONE, type PillTone } from "@/components/shared";
import { cn } from "@/lib/utils";

import { NavIcon } from "./icon-map";

export function StatCard({
  icon,
  label,
  value,
  tone = "primary",
  hint,
}: {
  icon?: string;
  label: string;
  value: React.ReactNode;
  tone?: PillTone;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {icon ? (
        <span
          className={cn(
            "mb-3 inline-flex size-9 items-center justify-center rounded-xl",
            PILL_TONE[tone],
          )}
        >
          <NavIcon name={icon} className="size-4" />
        </span>
      ) : null}
      <div className="text-3xl font-extrabold tracking-tight tabular-nums">
        {value}
      </div>
      <div className="mt-0.5 text-xs font-bold text-muted-foreground">
        {label}
      </div>
      {hint ? (
        <div className="mt-1 text-xs font-semibold text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
