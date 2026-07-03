import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/catalog/add-to-cart-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { tiptapToPlainText } from "@/lib/richtext";

async function loadCourse(tenantSlug: string, courseSlug: string) {
  const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return null;
  const course = await db.course.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug: courseSlug } },
    include: {
      tenant: { select: { slug: true, displayName: true } },
      category: true,
      sections: {
        orderBy: { position: "asc" },
        include: { lessons: { orderBy: { position: "asc" } } },
      },
      cohorts: {
        where: { status: "OPEN" },
        orderBy: { startsAt: "asc" },
        include: {
          prices: { where: { active: true, currency: "INR", region: null } },
          _count: { select: { enrollments: true } },
        },
      },
      prices: {
        where: { active: true, currency: "INR", region: null, cohortId: null },
      },
      reviews: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!course || course.status !== "PUBLISHED") return null;
  return course;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string; courseSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug, courseSlug } = await params;
  const course = await loadCourse(tenantSlug, courseSlug);
  if (!course) return {};
  return { title: course.title, description: course.subtitle ?? undefined };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; courseSlug: string }>;
}) {
  const { tenantSlug, courseSlug } = await params;
  const course = await loadCourse(tenantSlug, courseSlug);
  if (!course) notFound();

  const price = course.prices[0];
  const description = tiptapToPlainText(course.description);
  const lessonCount = course.sections.reduce((n, s) => n + s.lessons.length, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{course.level.toLowerCase()}</Badge>
            {course.category && <Badge variant="outline">{course.category.name}</Badge>}
            {course.liveEnabled && <Badge variant="secondary">live cohorts</Badge>}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{course.title}</h1>
          {course.subtitle && (
            <p className="mt-2 text-lg text-muted-foreground">{course.subtitle}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            By{" "}
            <Link href={`/c/${course.tenant.slug}`} className="font-medium hover:underline">
              {course.tenant.displayName}
            </Link>
            {" · "}
            {lessonCount} lessons
            {course.estimatedHours ? ` · ~${course.estimatedHours}h` : ""}
            {course.ratingAvg
              ? ` · ★ ${course.ratingAvg.toFixed(1)} (${course.ratingCount})`
              : ""}
          </p>

          {description && <p className="mt-6 whitespace-pre-line">{description}</p>}

          {course.outcomes.length > 0 && (
            <>
              <h2 className="mt-8 text-xl font-semibold">What you&apos;ll be able to do</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {course.outcomes.map((o) => (
                  <li key={o} className="text-sm">
                    ✓ {o}
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-8 text-xl font-semibold">Curriculum</h2>
          <div className="mt-3 space-y-3">
            {course.sections.map((section) => (
              <Card key={section.id}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 pb-4">
                  {section.lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between text-sm text-muted-foreground"
                    >
                      <span>
                        {lesson.type === "VIDEO" ? "▶" : lesson.type === "QUIZ" ? "?" : "·"}{" "}
                        {lesson.title}
                      </span>
                      <span className="flex items-center gap-2">
                        {lesson.isFreePreview && <Badge variant="outline">preview</Badge>}
                        {lesson.durationSec
                          ? `${Math.round(lesson.durationSec / 60)}m`
                          : ""}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {course.reviews.length > 0 && (
            <>
              <h2 className="mt-8 text-xl font-semibold">Reviews</h2>
              <div className="mt-3 space-y-3">
                {course.reviews.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="pt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{r.user.name}</span>
                        <span>{"★".repeat(r.rating)}</span>
                      </div>
                      {r.body && <p className="mt-1 text-muted-foreground">{r.body}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold">
                  {price ? formatMoney(price.amountMinor) : "Free"}
                </span>
                {price?.compareAtMinor && (
                  <span className="text-muted-foreground line-through">
                    {formatMoney(price.compareAtMinor)}
                  </span>
                )}
              </div>
              {course.selfPacedEnabled && (
                <AddToCartButton itemType="COURSE" courseId={course.id} label="Add to cart" />
              )}
              <p className="text-xs text-muted-foreground">
                14-day refund window, no questions asked. Certificate on completion.
              </p>
            </CardContent>
          </Card>

          {course.cohorts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming live cohorts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {course.cohorts.map((cohort) => {
                  const seatPrice = cohort.prices[0];
                  const seatsLeft =
                    cohort.capacity != null
                      ? cohort.capacity - cohort._count.enrollments
                      : null;
                  return (
                    <div key={cohort.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <div className="font-medium">{cohort.name}</div>
                          <div className="text-muted-foreground">
                            Starts{" "}
                            {cohort.startsAt.toLocaleDateString("en-IN", {
                              dateStyle: "medium",
                            })}
                            {seatsLeft != null ? ` · ${seatsLeft} seats left` : ""}
                          </div>
                        </div>
                        <span className="font-medium">
                          {seatPrice ? formatMoney(seatPrice.amountMinor) : "—"}
                        </span>
                      </div>
                      <AddToCartButton
                        itemType="COHORT_SEAT"
                        cohortId={cohort.id}
                        label="Reserve seat"
                        variant="outline"
                        size="sm"
                      />
                      <Separator />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
