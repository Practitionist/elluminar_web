import Link from "next/link";

import type { PriceDisplay } from "@/lib/ui/price";
import { cn } from "@/lib/utils";

import { GradientThumb } from "./gradient-thumb";
import { Pill } from "./pill";
import { PriceTag } from "./price-tag";
import { RatingStars } from "./rating-stars";

export type ProjectCardData = {
  title: string;
  href: string;
  tierLabel?: string; // "Sprint" | "Capstone" | "Flagship"
  durationLabel?: string; // "6-wk capstone"
  partnerLabel?: string; // partnerCompanyName / reviewer
  rating?: number | null;
  ratingCount?: number | null;
  price: PriceDisplay;
  gradientKey?: string;
  variant?: "light" | "dark";
};

export function ProjectCard({
  project,
  className,
}: {
  project: ProjectCardData;
  className?: string;
}) {
  const key = project.gradientKey ?? project.title;
  const variant = project.variant ?? "dark";
  return (
    <Link
      href={project.href}
      className={cn(
        "group block overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-foreground/5",
        className,
      )}
    >
      <GradientThumb
        keyer={key}
        variant={variant}
        className="h-32"
        topLeft={
          project.durationLabel ? (
            <span className="rounded-md bg-white/15 px-2.5 py-1 font-mono text-[11px] font-bold text-white backdrop-blur-sm">
              {project.durationLabel}
            </span>
          ) : undefined
        }
      />
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Pill tone="distinction" className="px-2.5 py-0.5 text-[11px]">
            {project.tierLabel ?? "Project"}
          </Pill>
          <RatingStars rating={project.rating} count={project.ratingCount} />
        </div>
        <h3 className="mb-2.5 line-clamp-2 text-[0.95rem] leading-snug font-extrabold text-foreground transition-colors group-hover:text-primary">
          {project.title}
        </h3>
        <div className="flex items-center justify-between gap-2">
          {project.partnerLabel ? (
            <span className="truncate text-xs font-semibold text-muted-foreground">
              {project.partnerLabel}
            </span>
          ) : (
            <span />
          )}
          <PriceTag price={project.price} />
        </div>
      </div>
    </Link>
  );
}
