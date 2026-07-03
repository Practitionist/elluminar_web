import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchPublishedCourseIds } from "@/lib/catalog";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
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
        prices: { where: { active: true, currency: "INR", region: null, cohortId: null } },
      },
    }),
    db.category.findMany({ orderBy: { sort: "asc" } }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Courses</h1>
          <p className="mt-1 text-muted-foreground">
            From independent technical creators. À la carte, always.
          </p>
        </div>
        <form className="w-full max-w-sm" action="/courses">
          <Input name="q" placeholder="Search courses…" defaultValue={q} />
        </form>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/courses">
          <Badge variant={!category ? "default" : "outline"}>All</Badge>
        </Link>
        {categories.map((c) => (
          <Link key={c.id} href={`/courses?category=${c.slug}`}>
            <Badge variant={category === c.slug ? "default" : "outline"}>{c.name}</Badge>
          </Link>
        ))}
      </div>

      {courses.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No courses match — try another search.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const price = course.prices[0];
            return (
              <Link
                key={course.id}
                href={`/courses/${course.tenant.slug}/${course.slug}`}
              >
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{course.level.toLowerCase()}</Badge>
                      {course.liveEnabled && <Badge variant="secondary">live</Badge>}
                    </div>
                    <CardTitle className="mt-1 line-clamp-2 text-base">
                      {course.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {course.subtitle ?? ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {course.tenant.displayName}
                    </span>
                    <span className="font-medium">
                      {price ? formatMoney(price.amountMinor) : "Free"}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
