import Link from "next/link";

import { StatCard } from "@/components/dashboard/stat-card";
import type { PillTone } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function StudioOverviewPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug);

  const [courseCount, projectCount, publishedCourses, enrollments] =
    await Promise.all([
      db.course.count({ where: { tenantId: tenant.id } }),
      db.project.count({ where: { tenantId: tenant.id } }),
      db.course.count({ where: { tenantId: tenant.id, status: "PUBLISHED" } }),
      db.enrollment.count({ where: { course: { tenantId: tenant.id } } }),
    ]);

  const stats: {
    label: string;
    value: number;
    icon: string;
    tone: PillTone;
  }[] = [
    { label: "Courses", value: courseCount, icon: "courses", tone: "primary" },
    {
      label: "Published",
      value: publishedCourses,
      icon: "storefront",
      tone: "success",
    },
    {
      label: "Projects",
      value: projectCount,
      icon: "projects",
      tone: "distinction",
    },
    {
      label: "Enrollments",
      value: enrollments,
      icon: "community",
      tone: "info",
    },
  ];

  const steps = [
    "Create a course and add sections, lessons, and a quiz.",
    "Set a price (self-paced, and per-cohort if you run live).",
    "Submit for review — approved schools appear in the marketplace.",
    "Optionally author a mentor-guided project with a rubric.",
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Overview
        </h1>
        <div className="flex gap-2">
          <Button
            render={<Link href={`/studio/${tenantSlug}/courses/new`} />}
            className="rounded-full"
          >
            New course
          </Button>
          <Button
            render={<Link href={`/studio/${tenantSlug}/projects/new`} />}
            variant="outline"
            className="rounded-full"
          >
            New project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-sm font-extrabold">Getting started</div>
        <div className="mt-1 text-xs font-semibold text-muted-foreground">
          The path to your first sale
        </div>
        <ol className="mt-4 space-y-2.5">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-xs font-extrabold text-primary-subtle-foreground">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
