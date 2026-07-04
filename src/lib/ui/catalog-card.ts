/**
 * Server-side mappers: real Prisma Course/Project rows (with `tenant` + active
 * `prices` included) → serializable card DTOs. Keep these on the server — they
 * touch BigInt via `displayFromPrices`.
 */

import type { CourseCardData } from "@/components/shared/course-card";
import type { ProjectCardData } from "@/components/shared/project-card";
import { displayFromPrices, type PriceLike } from "@/lib/ui/price";

type TenantRef = { slug: string; displayName: string };

type CourseInput = {
  title: string;
  slug: string;
  kind?: string | null;
  level?: string | null;
  liveEnabled?: boolean | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  tenant: TenantRef;
  prices: PriceLike[];
};

type ProjectInput = {
  title: string;
  slug: string;
  tier?: string | null;
  durationWeeksMin?: number | null;
  durationWeeksMax?: number | null;
  partnerCompanyName?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  tenant: TenantRef;
  prices: PriceLike[];
};

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const TIER_LABEL: Record<string, string> = {
  SPRINT: "Sprint",
  CAPSTONE: "Capstone",
  FLAGSHIP: "Flagship",
};

export function toCourseCardData(course: CourseInput): CourseCardData {
  const metaLabel = course.liveEnabled
    ? "Live cohort"
    : course.level
      ? (LEVEL_LABEL[course.level] ?? undefined)
      : undefined;
  return {
    title: course.title,
    href: `/courses/${course.tenant.slug}/${course.slug}`,
    kindLabel: course.kind === "MINI" ? "Mini" : "Course",
    metaLabel,
    creatorLabel: course.tenant.displayName,
    rating: course.ratingAvg ?? null,
    ratingCount: course.ratingCount ?? null,
    price: displayFromPrices(course.prices),
    gradientKey: course.slug,
  };
}

export function toProjectCardData(project: ProjectInput): ProjectCardData {
  const { durationWeeksMin: min, durationWeeksMax: max } = project;
  const durationLabel =
    min && max
      ? min === max
        ? `${min}-wk project`
        : `${min}–${max} wk project`
      : undefined;
  return {
    title: project.title,
    href: `/projects/${project.tenant.slug}/${project.slug}`,
    tierLabel: project.tier
      ? (TIER_LABEL[project.tier] ?? project.tier)
      : "Project",
    durationLabel,
    partnerLabel: project.partnerCompanyName ?? project.tenant.displayName,
    rating: project.ratingAvg ?? null,
    ratingCount: project.ratingCount ?? null,
    price: displayFromPrices(project.prices),
    gradientKey: project.slug,
    variant: "dark",
  };
}
