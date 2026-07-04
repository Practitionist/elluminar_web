import type { Metadata } from "next";
import { CheckCircle2, FileText, HelpCircle, Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/catalog/add-to-cart-button";
import { GradientThumb, Pill, RatingStars } from "@/components/shared";
import { db } from "@/lib/db";
import { priceDisplay } from "@/lib/ui/price";
import { cn } from "@/lib/utils";
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

const LESSON_ICON = { VIDEO: Play, QUIZ: HelpCircle } as const;

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; courseSlug: string }>;
}) {
  const { tenantSlug, courseSlug } = await params;
  const course = await loadCourse(tenantSlug, courseSlug);
  if (!course) notFound();

  const price = priceDisplay(course.prices[0] ?? null);
  const description = tiptapToPlainText(course.description);
  const lessonCount = course.sections.reduce((n, s) => n + s.lessons.length, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="primary">{course.level.toLowerCase()}</Pill>
            {course.category ? (
              <Pill tone="neutral">{course.category.name}</Pill>
            ) : null}
            {course.liveEnabled ? <Pill tone="info">Live cohorts</Pill> : null}
          </div>
          <h1 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
            {course.title}
          </h1>
          {course.subtitle ? (
            <p className="mt-2 text-lg text-muted-foreground">
              {course.subtitle}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>
              By{" "}
              <Link
                href={`/c/${course.tenant.slug}`}
                className="font-semibold text-foreground hover:underline"
              >
                {course.tenant.displayName}
              </Link>
            </span>
            <span aria-hidden>·</span>
            <span>{lessonCount} lessons</span>
            {course.estimatedHours ? (
              <>
                <span aria-hidden>·</span>
                <span>~{course.estimatedHours}h</span>
              </>
            ) : null}
            {course.ratingAvg ? (
              <RatingStars rating={course.ratingAvg} count={course.ratingCount} />
            ) : null}
          </div>

          {description ? (
            <p className="mt-6 leading-relaxed whitespace-pre-line text-foreground/90">
              {description}
            </p>
          ) : null}

          {course.outcomes.length > 0 ? (
            <>
              <h2 className="mt-10 font-display text-2xl font-medium tracking-tight">
                What you&apos;ll be able to do
              </h2>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {course.outcomes.map((o) => (
                  <li key={o} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h2 className="mt-10 font-display text-2xl font-medium tracking-tight">
            Curriculum
          </h2>
          <div className="mt-4 space-y-3">
            {course.sections.map((section) => (
              <div
                key={section.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="border-b border-border px-5 py-3 text-sm font-extrabold">
                  {section.title}
                </div>
                <div className="divide-y divide-border/60">
                  {section.lessons.map((lesson) => {
                    const Icon =
                      LESSON_ICON[lesson.type as keyof typeof LESSON_ICON] ??
                      FileText;
                    return (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between px-5 py-2.5 text-sm text-muted-foreground"
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="size-4 text-muted-foreground/70" />
                          {lesson.title}
                        </span>
                        <span className="flex items-center gap-2">
                          {lesson.isFreePreview ? (
                            <Pill tone="success" className="px-2 py-0.5 text-[10px]">
                              preview
                            </Pill>
                          ) : null}
                          {lesson.durationSec
                            ? `${Math.round(lesson.durationSec / 60)}m`
                            : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {course.reviews.length > 0 ? (
            <>
              <h2 className="mt-10 font-display text-2xl font-medium tracking-tight">
                Reviews
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {course.reviews.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-border bg-card p-4 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold">{r.user.name}</span>
                      <span className="text-distinction">
                        {"★".repeat(r.rating)}
                      </span>
                    </div>
                    {r.body ? (
                      <p className="mt-1.5 text-muted-foreground">{r.body}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <aside>
          <div className="sticky top-20 space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <GradientThumb keyer={course.slug} className="h-24" />
              <div className="space-y-4 p-5">
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-3xl font-extrabold tracking-tight",
                      price.isFree && "text-success-subtle-foreground",
                    )}
                  >
                    {price.label}
                  </span>
                  {price.compareLabel ? (
                    <s className="font-semibold text-muted-foreground">
                      {price.compareLabel}
                    </s>
                  ) : null}
                </div>
                {course.selfPacedEnabled ? (
                  <AddToCartButton
                    itemType="COURSE"
                    courseId={course.id}
                    label="Add to cart"
                  />
                ) : null}
                <p className="text-xs text-muted-foreground">
                  14-day refund window, no questions asked. Certificate on
                  completion.
                </p>
              </div>
            </div>

            {course.cohorts.length > 0 ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="text-sm font-extrabold">
                  Upcoming live cohorts
                </div>
                <div className="mt-3 space-y-4">
                  {course.cohorts.map((cohort) => {
                    const seatPrice = cohort.prices[0];
                    const seatsLeft =
                      cohort.capacity != null
                        ? cohort.capacity - cohort._count.enrollments
                        : null;
                    return (
                      <div
                        key={cohort.id}
                        className="space-y-2 border-t border-border pt-4 first:border-0 first:pt-0"
                      >
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <div>
                            <div className="font-bold">{cohort.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Starts{" "}
                              {cohort.startsAt.toLocaleDateString("en-IN", {
                                dateStyle: "medium",
                              })}
                              {seatsLeft != null
                                ? ` · ${seatsLeft} seats left`
                                : ""}
                            </div>
                          </div>
                          <span className="font-extrabold">
                            {seatPrice
                              ? priceDisplay(seatPrice).label
                              : "—"}
                          </span>
                        </div>
                        <AddToCartButton
                          itemType="COHORT_SEAT"
                          cohortId={cohort.id}
                          label="Reserve seat"
                          variant="outline"
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
