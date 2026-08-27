import "server-only";

import { unstable_cache } from "next/cache";

import type { CourseCardData } from "@/components/shared/course-card";
import type { ProjectCardData } from "@/components/shared/project-card";
import { db } from "@/lib/db";
import { toCourseCardData, toProjectCardData } from "@/lib/ui/catalog-card";
import type { Prisma } from "@/generated/prisma/client";

/** Marketplace course search: Postgres FTS over the GIN index, ILIKE fallback. */
export async function searchPublishedCourseIds(q: string): Promise<string[]> {
  const query = q.trim();
  if (!query) return [];
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Course"
    WHERE status = 'PUBLISHED' AND visibility = 'MARKETPLACE'
      AND (
        to_tsvector('english', coalesce(title,'') || ' ' || coalesce(subtitle,''))
          @@ plainto_tsquery('english', ${query})
        OR title ILIKE ${"%" + query + "%"}
      )
    LIMIT 60
  `;
  return rows.map((r) => r.id);
}

export async function searchPublishedProjectIds(q: string): Promise<string[]> {
  const query = q.trim();
  if (!query) return [];
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Project"
    WHERE status = 'PUBLISHED' AND visibility = 'MARKETPLACE'
      AND (
        to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,''))
          @@ plainto_tsquery('english', ${query})
        OR title ILIKE ${"%" + query + "%"}
      )
    LIMIT 60
  `;
  return rows.map((r) => r.id);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cached browse readers
 *
 * `/courses` and `/projects` read `searchParams`, which pins them to dynamic
 * rendering — so unlike the rest of `(marketing)` they cannot be served as
 * static HTML and every request really does invoke the function. What they can
 * avoid is the database round trip, and that round trip is expensive here:
 * Netlify runs these functions in **us-east-2** while Supabase lives in
 * **ap-south-1**, so every query crosses the planet. Measured on production,
 * warm: `/` (no queries) 0.54 s vs `/courses` 1.18 s and `/projects` 1.47 s —
 * roughly 0.6–0.9 s of cross-region database time per request.
 *
 * The Netlify Next Runtime backs Next's Data Cache with Netlify Blobs, so
 * `unstable_cache` entries are durable and shared across function instances
 * and CDN nodes rather than living in per-instance memory. Caching here
 * therefore removes that round trip for every visitor after the first.
 *
 * Two deliberate constraints:
 *
 *  1. Only the *browse* path is cached. Free-text `q` has unbounded
 *     cardinality and would thrash the cache with single-use entries, so a
 *     search falls through to a live query.
 *
 *  2. What gets cached is the mapped card DTO, never the raw Prisma row.
 *     `Price.amountMinor` is a `bigint` and `JSON.stringify` throws on BigInt,
 *     so caching rows would fail at runtime while passing `tsc` cleanly.
 *     `toCourseCardData` / `toProjectCardData` collapse money to display
 *     strings, which are plain JSON. Keep it that way.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Catalog copy changes rarely; five minutes keeps it fresh without churn. */
const CATALOG_REVALIDATE = 300;

export type CatalogCategory = { id: string; slug: string; name: string };
export type CatalogCourseEntry = {
  categoryId: string | null;
  card: CourseCardData;
};
export type CatalogProjectEntry = {
  categoryId: string | null;
  card: ProjectCardData;
};

/** Category chips — a fixed query, so a single cache entry serves everyone. */
export const getCatalogCategories = unstable_cache(
  async (): Promise<CatalogCategory[]> =>
    db.category.findMany({
      orderBy: { sort: "asc" },
      // Explicit select: `Category` carries `Date` columns that would come back
      // from the cache as ISO strings.
      select: { id: true, slug: true, name: true },
    }),
  ["catalog", "categories"],
  { revalidate: CATALOG_REVALIDATE, tags: ["catalog"] },
);

async function fetchCourseEntries(
  where: Prisma.CourseWhereInput,
): Promise<CatalogCourseEntry[]> {
  const rows = await db.course.findMany({
    where,
    orderBy: [{ enrollmentCount: "desc" }, { publishedAt: "desc" }],
    take: 48,
    include: {
      tenant: { select: { slug: true, displayName: true } },
      category: { select: { slug: true, name: true } },
      prices: {
        where: { active: true, currency: "INR", region: null, cohortId: null },
      },
    },
  });
  return rows.map((course) => ({
    categoryId: course.categoryId,
    card: toCourseCardData(course),
  }));
}

const getBrowseCourses = unstable_cache(
  async (category?: string, level?: string) => {
    const where: Prisma.CourseWhereInput = {
      status: "PUBLISHED",
      visibility: "MARKETPLACE",
      kind: "COURSE",
    };
    if (category) where.category = { slug: category };
    if (level) where.level = level as never;
    return fetchCourseEntries(where);
  },
  ["catalog", "courses", "browse"],
  { revalidate: CATALOG_REVALIDATE, tags: ["catalog", "catalog:courses"] },
);

export async function getCourseCatalog(filters: {
  q?: string;
  category?: string;
  level?: string;
}): Promise<CatalogCourseEntry[]> {
  const { q, category, level } = filters;
  if (!q) return getBrowseCourses(category, level);

  const where: Prisma.CourseWhereInput = {
    status: "PUBLISHED",
    visibility: "MARKETPLACE",
    kind: "COURSE",
    id: { in: await searchPublishedCourseIds(q) },
  };
  if (category) where.category = { slug: category };
  if (level) where.level = level as never;
  return fetchCourseEntries(where);
}

async function fetchProjectEntries(
  where: Prisma.ProjectWhereInput,
): Promise<CatalogProjectEntry[]> {
  const rows = await db.project.findMany({
    where,
    orderBy: [{ purchaseCount: "desc" }, { publishedAt: "desc" }],
    take: 48,
    include: {
      tenant: { select: { slug: true, displayName: true } },
      category: { select: { slug: true, name: true } },
      prices: {
        where: {
          active: true,
          currency: "INR",
          region: null,
          mentorLevel: null,
        },
      },
    },
  });
  return rows.map((project) => ({
    categoryId: project.categoryId,
    card: toProjectCardData(project),
  }));
}

const getBrowseProjects = unstable_cache(
  async (tier?: string, category?: string) => {
    const where: Prisma.ProjectWhereInput = {
      status: "PUBLISHED",
      visibility: "MARKETPLACE",
    };
    if (tier) where.tier = tier as never;
    if (category) where.category = { slug: category };
    return fetchProjectEntries(where);
  },
  ["catalog", "projects", "browse"],
  { revalidate: CATALOG_REVALIDATE, tags: ["catalog", "catalog:projects"] },
);

export async function getProjectCatalog(filters: {
  q?: string;
  tier?: string;
  category?: string;
}): Promise<CatalogProjectEntry[]> {
  const { q, tier, category } = filters;
  if (!q) return getBrowseProjects(tier, category);

  const where: Prisma.ProjectWhereInput = {
    status: "PUBLISHED",
    visibility: "MARKETPLACE",
    id: { in: await searchPublishedProjectIds(q) },
  };
  if (tier) where.tier = tier as never;
  if (category) where.category = { slug: category };
  return fetchProjectEntries(where);
}
