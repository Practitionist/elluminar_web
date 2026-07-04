import Link from "next/link";

import type { PriceDisplay } from "@/lib/ui/price";
import { cn } from "@/lib/utils";

import { GradientThumb } from "./gradient-thumb";
import { Pill } from "./pill";
import { PriceTag } from "./price-tag";
import { RatingStars } from "./rating-stars";

export type CourseCardData = {
  title: string;
  href: string;
  kindLabel?: string; // "Course" | "Mini"
  metaLabel?: string; // "42 lessons"
  creatorLabel?: string; // "Rohan S · Flipkart" (tenant.displayName)
  rating?: number | null; // ratingAvg
  ratingCount?: number | null;
  price: PriceDisplay;
  gradientKey?: string;
};

export function CourseCard({
  course,
  className,
}: {
  course: CourseCardData;
  className?: string;
}) {
  const key = course.gradientKey ?? course.title;
  return (
    <Link
      href={course.href}
      className={cn(
        "group block overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-foreground/5",
        className,
      )}
    >
      <GradientThumb
        keyer={key}
        className="h-32"
        topLeft={
          course.metaLabel ? (
            <span className="rounded-full bg-foreground/70 px-2.5 py-1 text-[11px] font-bold text-background">
              {course.metaLabel}
            </span>
          ) : undefined
        }
        topRight={
          course.price.isFree ? (
            <Pill tone="success" className="px-2.5 py-0.5 text-[11px]">
              FREE
            </Pill>
          ) : undefined
        }
      />
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Pill tone="primary" className="px-2.5 py-0.5 text-[11px]">
            {course.kindLabel ?? "Course"}
          </Pill>
          <RatingStars rating={course.rating} count={course.ratingCount} />
        </div>
        <h3 className="mb-2.5 line-clamp-2 text-[0.95rem] leading-snug font-extrabold text-foreground transition-colors group-hover:text-primary">
          {course.title}
        </h3>
        <div className="flex items-center justify-between gap-2">
          {course.creatorLabel ? (
            <span className="truncate text-xs font-semibold text-muted-foreground">
              {course.creatorLabel}
            </span>
          ) : (
            <span />
          )}
          <PriceTag price={course.price} />
        </div>
      </div>
    </Link>
  );
}
