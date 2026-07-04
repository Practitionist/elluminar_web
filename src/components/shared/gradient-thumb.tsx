import { gradientForKey } from "@/lib/ui/gradients";
import { cn } from "@/lib/utils";

/**
 * A gradient thumbnail tile (stands in for a `MediaAsset` image). Deterministic
 * per `keyer`, with optional overlay badges and a decorative rotated corner.
 */
export function GradientThumb({
  keyer,
  variant = "light",
  className,
  topLeft,
  topRight,
  children,
}: {
  keyer: string;
  variant?: "light" | "dark";
  className?: string;
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ backgroundImage: gradientForKey(keyer, variant) }}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-4 -bottom-6 h-24 w-24 rotate-[16deg] rounded-[28px]",
          variant === "dark" ? "bg-white/10" : "bg-white/30",
        )}
      />
      {topLeft ? <div className="absolute top-3 left-3 z-10">{topLeft}</div> : null}
      {topRight ? (
        <div className="absolute top-3 right-3 z-10">{topRight}</div>
      ) : null}
      {children}
    </div>
  );
}
