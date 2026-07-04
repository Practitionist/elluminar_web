import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CourseCard, GradientThumb, Pill, ProjectCard } from "@/components/shared";
import { db } from "@/lib/db";
import { toCourseCardData, toProjectCardData } from "@/lib/ui/catalog-card";
import { tiptapToPlainText } from "@/lib/richtext";

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "•"
  );
}

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
  const isOrg = tenant.type === "ENTERPRISE" || tenant.type === "UNIVERSITY";
  const programs = isOrg
    ? await db.program.findMany({
        where: { ownerTenantId: tenant.id, status: "ACTIVE" },
        include: {
          certificateTemplate: { select: { coBrand: true } },
          _count: { select: { items: true, cohorts: true } },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <header className="flex flex-col items-center gap-5 border-b border-border pb-10 text-center sm:flex-row sm:items-start sm:text-left">
        <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary-subtle text-xl font-extrabold text-primary-subtle-foreground">
          {initialsOf(tenant.displayName)}
        </span>
        <div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
              {tenant.displayName}
            </h1>
            {isOrg && (
              <Pill tone="info">
                {tenant.type === "UNIVERSITY" ? "University partner" : "Enterprise partner"}
              </Pill>
            )}
          </div>
          {about && <p className="mt-3 max-w-2xl text-muted-foreground">{about}</p>}
        </div>
      </header>

      {isOrg && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium tracking-tight">Programs</h2>
          {programs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Program details are shared with enrolled cohorts.
            </p>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {programs.map((program) => {
                const coBrand = (program.certificateTemplate?.coBrand ?? null) as {
                  partnerName?: string;
                } | null;
                return (
                  <div
                    key={program.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <GradientThumb keyer={program.id} className="h-20" />
                    <div className="p-5">
                      <h3 className="line-clamp-2 text-[0.95rem] leading-snug font-extrabold text-foreground">
                        {program.title}
                      </h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {program._count.items} items · {program._count.cohorts} cohorts
                        {coBrand?.partnerName
                          ? ` · co-certified with ${coBrand.partnerName}`
                          : ""}
                      </p>
                      <p className="mt-3 text-xs font-semibold text-muted-foreground">
                        Cohort-based · co-branded certificate on completion
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium tracking-tight">Courses</h2>
        {tenant.courses.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No published courses yet.</p>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tenant.courses.map((course) => (
              <CourseCard key={course.id} course={toCourseCardData({ ...course, tenant })} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium tracking-tight">
          Mentor-guided projects
        </h2>
        {tenant.projects.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No published projects yet.</p>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tenant.projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={toProjectCardData({ ...project, tenant })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
