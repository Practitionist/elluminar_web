import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchPublishedProjectIds } from "@/lib/catalog";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Mentor-guided projects" };

export default async function ProjectsCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string }>;
}) {
  const { q, tier } = await searchParams;

  const where: Prisma.ProjectWhereInput = {
    status: "PUBLISHED",
    visibility: "MARKETPLACE",
  };
  if (tier) where.tier = tier as never;
  if (q) {
    const ids = await searchPublishedProjectIds(q);
    where.id = { in: ids };
  }

  const projects = await db.project.findMany({
    where,
    orderBy: [{ purchaseCount: "desc" }, { publishedAt: "desc" }],
    take: 48,
    include: {
      tenant: { select: { slug: true, displayName: true } },
      prices: {
        where: { active: true, currency: "INR", region: null, mentorLevel: null },
      },
    },
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Mentor-guided projects
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Take-home-assessment-scale briefs, rubric-graded by real mentors.
            Buy one project — no bootcamp commitment.
          </p>
        </div>
        <form className="w-full max-w-sm" action="/projects">
          <Input name="q" placeholder="Search projects…" defaultValue={q} />
        </form>
      </div>

      <div className="mt-6 flex gap-2">
        {["", "SPRINT", "CAPSTONE", "FLAGSHIP"].map((t) => (
          <Link key={t || "all"} href={t ? `/projects?tier=${t}` : "/projects"}>
            <Badge variant={tier === t || (!tier && !t) ? "default" : "outline"}>
              {t ? t.toLowerCase() : "All tiers"}
            </Badge>
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No projects match.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const price = project.prices[0];
            return (
              <Link
                key={project.id}
                href={`/projects/${project.tenant.slug}/${project.slug}`}
              >
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge>{project.tier.toLowerCase()}</Badge>
                      <Badge variant="outline">
                        {project.durationWeeksMin}–{project.durationWeeksMax} wks
                      </Badge>
                      {project.defenseRequired && (
                        <Badge variant="secondary">live defense</Badge>
                      )}
                    </div>
                    <CardTitle className="mt-1 line-clamp-2 text-base">
                      {project.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-3">
                      {project.summary}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {project.tenant.displayName}
                    </span>
                    <span className="font-medium">
                      {price ? formatMoney(price.amountMinor) : "—"}
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
