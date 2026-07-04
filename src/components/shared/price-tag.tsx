import type { PriceDisplay } from "@/lib/ui/price";
import { cn } from "@/lib/utils";

export function PriceTag({
  price,
  className,
}: {
  price: PriceDisplay;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span
        className={cn(
          "text-[0.95rem] font-extrabold",
          price.isFree && "text-success-subtle-foreground",
        )}
      >
        {price.label}
      </span>
      {price.compareLabel ? (
        <s className="text-xs font-semibold text-muted-foreground">
          {price.compareLabel}
        </s>
      ) : null}
    </span>
  );
}
