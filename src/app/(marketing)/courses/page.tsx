import Link from "next/link";

import { CourseCard, SectionEyebrow, SectionHeading } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { searchPublishedCourseIds } from "@/lib/catalog";
import { db } from "@/lib/db";
import { toCourseCardData } from "@/lib/ui/catalog-card";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Browse courses" };

export default async function CoursesCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; level?: string }>;
}) {
  const { q, category, level } = await searchParams;

  const where: Prisma.CourseWhereInput = {
    status: "PUBLISHED",
    visibility: "MARKETPLACE",
    kind: "COURSE",
  };
  if (category) where.category = { slug: category };
  if (level) where.level = level as never;
  if (q) {
    const ids = await searchPublishedCourseIds(q);
    where.id = { in: ids };
  }

  const [courses, categories] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: [{ enrollmentCount: "desc" }, { publishedAt: "desc" }],
      take: 48,
      include: {
        tenant: { select: { slug: true, displayName: true } },
        prices: {
          where: { active: true, currency: "INR", region: null, cohortId: null },
        },
      },
    }),
    db.category.findMany({ orderBy: { sort: "asc" } }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-3">
          <SectionEyebrow>Learn</SectionEyebrow>
          <SectionHeading as="h1">Courses that go deep</SectionHeading>
          <p className="max-w-xl text-muted-foreground">
            From independent technical creators. À la carte, always.
          </p>
        </div>
        <form className="w-full max-w-sm" action="/courses">
          <Input
            name="q"
            placeholder="Search courses…"
            defaultValue={q}
            className="rounded-full"
          />
        </form>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <FilterChip href="/courses" active={!category}>
          All
        </FilterChip>
        {categories.map((c) => (
          <FilterChip
            key={c.id}
            href={`/courses?category=${c.slug}`}
            active={category === c.slug}
          >
            {c.name}
          </FilterChip>
        ))}
      </div>

      {courses.length === 0 ? (
        <p className="mt-12 text-muted-foreground">
          No courses match — try another search.
        </p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={toCourseCardData(course)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:bg-muted/60",
      )}
    >
      {children}
    </Link>
  );
}
