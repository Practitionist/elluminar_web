import { BadgeCheck, Play } from "lucide-react";

import { cn } from "@/lib/utils";

import { Pill } from "./pill";

type Rubric = { label: string; score: number; max?: number };

export type CredentialProofData = {
  code?: string;
  holderName?: string;
  holderInitials?: string;
  title?: string;
  meta?: string;
  gradeLabel?: string;
  rubric?: Rubric[];
  reviewerQuote?: string;
  reviewerName?: string;
  reviewerInitials?: string;
};

const SAMPLE: Required<Omit<CredentialProofData, "holderInitials" | "reviewerInitials">> & {
  holderInitials: string;
  reviewerInitials: string;
} = {
  code: "LMS-9F3K-QX",
  holderName: "Ananya Iyer",
  holderInitials: "AI",
  title: "Payments API — Build, Scale, Defend",
  meta: "6-week mentored capstone",
  gradeLabel: "★ Distinction · 8.7 / 10",
  rubric: [
    { label: "Architecture", score: 9.0 },
    { label: "Code quality", score: 8.0 },
    { label: "Ops readiness", score: 8.5 },
    { label: "Live defense", score: 9.0 },
  ],
  reviewerQuote: "Reads like a 3-year engineer's system.",
  reviewerName: "Vikram K · L6, Backend",
  reviewerInitials: "VK",
};

/**
 * Marketing illustration of a verified credential — the product's core
 * differentiator. Sample data by default; override any field.
 */
export function CredentialProofCard({
  data,
  className,
}: {
  data?: CredentialProofData;
  className?: string;
}) {
  const c = { ...SAMPLE, ...data };
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-foreground/5",
        className,
      )}
    >
      {/* valid banner */}
      <div className="flex items-center gap-3 border-b border-success/20 bg-success-subtle px-6 py-3.5">
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-success text-success-foreground">
          <BadgeCheck className="size-4" />
        </span>
        <span className="flex-1 text-sm font-extrabold text-success-subtle-foreground">
          Valid credential · re-checked 3 seconds ago
        </span>
        <span className="rounded-lg border border-success/20 bg-card px-3 py-1.5 font-mono text-xs font-semibold text-success-subtle-foreground">
          {c.code}
        </span>
      </div>

      <div className="p-6">
        {/* holder */}
        <div className="mb-5 flex items-center gap-3.5">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary-subtle text-lg font-extrabold text-primary-subtle-foreground">
            {c.holderInitials}
          </span>
          <div className="flex-1">
            <div className="text-lg font-extrabold text-foreground">
              {c.holderName}
            </div>
            <div className="text-xs font-semibold text-muted-foreground">
              {c.title} · {c.meta}
            </div>
          </div>
          <Pill tone="distinction">{c.gradeLabel}</Pill>
        </div>

        {/* rubric bars */}
        <div className="grid gap-x-7 gap-y-2.5 sm:grid-cols-2">
          {c.rubric.map((r) => {
            const pct = Math.round((r.score / (r.max ?? 10)) * 100);
            return (
              <div
                key={r.label}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 text-xs font-bold text-muted-foreground"
              >
                <span className="w-24">{r.label}</span>
                <span className="h-[7px] rounded-full bg-muted">
                  <span
                    className="block h-[7px] rounded-full bg-success"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-8 text-right font-extrabold text-foreground">
                  {r.score.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>

        {/* reviewer */}
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-[11px] font-extrabold text-primary-subtle-foreground">
            {c.reviewerInitials}
          </span>
          <span className="flex-1 text-xs font-semibold text-muted-foreground">
            &ldquo;{c.reviewerQuote}&rdquo; — {c.reviewerName}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-primary">
            <Play className="size-3 fill-current" />
            Defense
          </span>
        </div>
      </div>
    </div>
  );
}
