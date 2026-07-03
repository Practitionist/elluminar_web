import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function StudioOverviewPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug);

  const [courseCount, projectCount, publishedCourses, enrollments] = await Promise.all([
    db.course.count({ where: { tenantId: tenant.id } }),
    db.project.count({ where: { tenantId: tenant.id } }),
    db.course.count({ where: { tenantId: tenant.id, status: "PUBLISHED" } }),
    db.enrollment.count({ where: { course: { tenantId: tenant.id } } }),
  ]);

  const stats = [
    { label: "Courses", value: courseCount },
    { label: "Published", value: publishedCourses },
    { label: "Projects", value: projectCount },
    { label: "Enrollments", value: enrollments },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <div className="flex gap-2">
          <Button render={<Link href={`/studio/${tenantSlug}/courses/new`} />}>
            New course
          </Button>
          <Button
            render={<Link href={`/studio/${tenantSlug}/projects/new`} />}
            variant="outline"
          >
            New project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>The path to your first sale</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Create a course and add sections, lessons, and a quiz.</p>
          <p>2. Set a price (self-paced, and per-cohort if you run live).</p>
          <p>3. Submit for review — approved schools appear in the marketplace.</p>
          <p>4. Optionally author a mentor-guided project with a rubric.</p>
        </CardContent>
      </Card>
    </div>
  );
}
