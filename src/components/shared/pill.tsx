import { cn } from "@/lib/utils";

/**
 * Semantic pill/badge tones, mapped to the design-token accent system.
 * primary = brand pink · success = verified · distinction = ⭐/capstone ·
 * info = recommended · neutral = default · ink = high-contrast.
 */
export const PILL_TONE = {
  primary: "bg-primary-subtle text-primary-subtle-foreground",
  success: "bg-success-subtle text-success-subtle-foreground",
  distinction: "bg-distinction-subtle text-distinction-subtle-foreground",
  info: "bg-info-subtle text-info-subtle-foreground",
  destructive: "bg-destructive-subtle text-destructive-subtle-foreground",
  neutral: "bg-muted text-muted-foreground",
  ink: "bg-foreground text-background",
} as const;

export type PillTone = keyof typeof PILL_TONE;

export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap",
        PILL_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
