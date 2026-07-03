import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { tiptapToPlainText } from "@/lib/richtext";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return {};
  return {
    title: tenant.displayName,
    description: tiptapToPlainText(tenant.about).slice(0, 160) || undefined,
  };
}

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await db.tenant.findUnique({
    where: { slug: tenantSlug },
    include: {
      courses: {
        where: { status: "PUBLISHED", visibility: { in: ["MARKETPLACE", "TENANT_ONLY"] } },
        include: { prices: { where: { active: true, currency: "INR", region: null } } },
        orderBy: { publishedAt: "desc" },
      },
      projects: {
        where: { status: "PUBLISHED", visibility: { in: ["MARKETPLACE", "TENANT_ONLY"] } },
        include: {
          prices: {
            where: { active: true, currency: "INR", region: null, mentorLevel: null },
          },
        },
        orderBy: { publishedAt: "desc" },
      },
    },
  });
  if (!tenant || tenant.status === "ARCHIVED" || tenant.status === "SUSPENDED") notFound();

  const about = tiptapToPlainText(tenant.about);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <header className="border-b pb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{tenant.displayName}</h1>
        {about && <p className="mt-3 max-w-2xl text-muted-foreground">{about}</p>}
      </header>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Courses</h2>
        {tenant.courses.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No published courses yet.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tenant.courses.map((course) => {
              const price = course.prices[0];
              return (
                <Link key={course.id} href={`/courses/${tenant.slug}/${course.slug}`}>
                  <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{course.level.toLowerCase()}</Badge>
                        {course.liveEnabled && <Badge variant="secondary">live cohorts</Badge>}
                      </div>
                      <CardTitle className="mt-2 line-clamp-2 text-base">{course.title}</CardTitle>
                      {course.subtitle && (
                        <CardDescription className="line-clamp-2">{course.subtitle}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="text-sm font-medium">
                      {price ? formatMoney(price.amountMinor, price.currency) : "Free"}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Mentor-guided projects</h2>
        {tenant.projects.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No published projects yet.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tenant.projects.map((project) => {
              const price = project.prices[0];
              return (
                <Link key={project.id} href={`/projects/${tenant.slug}/${project.slug}`}>
                  <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Badge>{project.tier.toLowerCase()}</Badge>
                        <Badge variant="outline">
                          {project.durationWeeksMin}–{project.durationWeeksMax} weeks
                        </Badge>
                      </div>
                      <CardTitle className="mt-2 line-clamp-2 text-base">{project.title}</CardTitle>
                      <CardDescription className="line-clamp-3">{project.summary}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm font-medium">
                      {price ? formatMoney(price.amountMinor, price.currency) : "—"}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
