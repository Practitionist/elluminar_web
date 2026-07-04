import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function RatingStars({
  rating,
  count,
  className,
}: {
  rating?: number | null;
  count?: number | null;
  className?: string;
}) {
  if (rating == null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-bold text-foreground",
        className,
      )}
    >
      <Star className="size-3.5 fill-distinction text-distinction" />
      {rating.toFixed(1)}
      {count != null && count > 0 ? (
        <span className="font-medium text-muted-foreground">({count})</span>
      ) : null}
    </span>
  );
}
