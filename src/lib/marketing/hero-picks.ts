import "server-only";

import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import {
  arrangeHeroCards,
  courseHeroCard,
  projectHeroCard,
  type HeroCard,
} from "@/lib/marketing/hero-cards";

/** Revalidate tag for the hero showcase — see `getHeroShowcase`. */
export const HERO_SHOWCASE_TAG = "marketing:hero-showcase";

const REVALIDATE_SECONDS = 300;

/**
 * The three published catalog items the landing-page hero links to.
 *
 * One indexed query pair against `@@index([status, visibility])`, ordered
 * deterministically so the hero does not shuffle between renders.
 */
async function queryHeroShowcase(): Promise<HeroCard[]> {
  const [courses, projects] = await Promise.all([
    db.course.findMany({
      where: { status: "PUBLISHED", visibility: "MARKETPLACE", kind: "COURSE" },
      orderBy: [{ enrollmentCount: "desc" }, { id: "asc" }],
      take: 3,
      select: {
        id: true,
        title: true,
        slug: true,
        level: true,
        liveEnabled: true,
        selfPacedEnabled: true,
        tenant: { select: { slug: true } },
        cohorts: {
          where: { status: { in: ["OPEN", "RUNNING"] } },
          select: { id: true },
          take: 1,
        },
        lessons: {
          where: { type: "CODE_LAB" },
          select: { id: true },
          take: 1,
        },
      },
    }),
    db.project.findMany({
      where: { status: "PUBLISHED", visibility: "MARKETPLACE" },
      orderBy: [{ purchaseCount: "desc" }, { id: "asc" }],
      take: 2,
      select: {
        id: true,
        title: true,
        slug: true,
        tier: true,
        durationWeeksMin: true,
        durationWeeksMax: true,
        mentorHoursBudget: true,
        tenant: { select: { slug: true } },
      },
    }),
  ]);

  return arrangeHeroCards(
    courses.map((course) =>
      courseHeroCard({
        id: course.id,
        title: course.title,
        slug: course.slug,
        tenantSlug: course.tenant.slug,
        level: course.level,
        liveEnabled: course.liveEnabled,
        selfPacedEnabled: course.selfPacedEnabled,
        hasOpenCohort: course.cohorts.length > 0,
        hasCodeLab: course.lessons.length > 0,
      }),
    ),
    projects.map((project) =>
      projectHeroCard({
        id: project.id,
        title: project.title,
        slug: project.slug,
        tenantSlug: project.tenant.slug,
        tier: project.tier,
        durationWeeksMin: project.durationWeeksMin,
        durationWeeksMax: project.durationWeeksMax,
        // Prisma Decimal → number, so the cached value stays serializable.
        mentorHours: Number(project.mentorHoursBudget),
      }),
    ),
  );
}

const cachedHeroShowcase = unstable_cache(queryHeroShowcase, ["marketing", "hero-showcase", "v1"], {
  revalidate: REVALIDATE_SECONDS,
  tags: [HERO_SHOWCASE_TAG],
});

/**
 * Hero showcase items, cached for {@link REVALIDATE_SECONDS} and tagged with
 * {@link HERO_SHOWCASE_TAG}, so the marketing segment costs one catalog query
 * per window rather than one per request.
 *
 * Never throws: an empty, unreachable or unseeded catalog yields `[]` and the
 * hero renders its cards without the showcase rather than 500ing the landing
 * page. Failures are not cached (the cache only stores resolved values), so a
 * transient database blip does not blank the hero for the whole window.
 */
export async function getHeroShowcase(): Promise<HeroCard[]> {
  try {
    return await cachedHeroShowcase();
  } catch (err) {
    console.error("[hero showcase]", err);
    return [];
  }
}
