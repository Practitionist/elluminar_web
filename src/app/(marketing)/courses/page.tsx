import Link from "next/link";

import {
  CarouselItem,
  CarouselRow,
  CourseCard,
  SectionEyebrow,
  SectionHeading,
} from "@/components/shared";
import { Input } from "@/components/ui/input";
import { getCatalogCategories, getCourseCatalog } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export const metadata = { title: "Browse courses" };

export default async function CoursesCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; level?: string }>;
}) {
  const { q, category, level } = await searchParams;
  const filtered = Boolean(q || category || level);

  const [courses, categories] = await Promise.all([
    getCourseCatalog({ q, category, level }),
    getCatalogCategories(),
  ]);

  // Netflix-style browse: category rows when exploring everything; a plain
  // results grid once the learner searches or narrows to one category.
  const grouped = !filtered
    ? categories
        .map((c) => ({
          category: c,
          courses: courses.filter((course) => course.categoryId === c.id),
        }))
        .filter((g) => g.courses.length > 0)
    : [];

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
      ) : filtered ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.card.href} course={course.card} />
          ))}
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          <CarouselRow title="Popular right now">
            {courses.slice(0, 12).map((course) => (
              <CarouselItem key={course.card.href}>
                <CourseCard course={course.card} />
              </CarouselItem>
            ))}
          </CarouselRow>
          {grouped.map((g) => (
            <CarouselRow
              key={g.category.id}
              title={g.category.name}
              href={`/courses?category=${g.category.slug}`}
            >
              {g.courses.map((course) => (
                <CarouselItem key={course.card.href}>
                  <CourseCard course={course.card} />
                </CarouselItem>
              ))}
            </CarouselRow>
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
