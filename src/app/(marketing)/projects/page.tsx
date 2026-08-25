import Link from "next/link";

import {
  CarouselItem,
  CarouselRow,
  ProjectCard,
  SectionEyebrow,
  SectionHeading,
} from "@/components/shared";
import { Input } from "@/components/ui/input";
import { searchPublishedProjectIds } from "@/lib/catalog";
import { db } from "@/lib/db";
import { toProjectCardData } from "@/lib/ui/catalog-card";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Mentor-guided projects" };

const TIERS: [string, string][] = [
  ["", "All tiers"],
  ["SPRINT", "Sprint"],
  ["CAPSTONE", "Capstone"],
  ["FLAGSHIP", "Flagship"],
];

export default async function ProjectsCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string; category?: string }>;
}) {
  const { q, tier, category } = await searchParams;
  const filtered = Boolean(q || tier || category);

  const where: Prisma.ProjectWhereInput = {
    status: "PUBLISHED",
    visibility: "MARKETPLACE",
  };
  if (tier) where.tier = tier as never;
  if (category) where.category = { slug: category };
  if (q) {
    const ids = await searchPublishedProjectIds(q);
    where.id = { in: ids };
  }

  const [projects, categories] = await Promise.all([
    db.project.findMany({
      where,
      orderBy: [{ purchaseCount: "desc" }, { publishedAt: "desc" }],
      take: 48,
      include: {
        tenant: { select: { slug: true, displayName: true } },
        category: { select: { slug: true, name: true } },
        prices: {
          where: { active: true, currency: "INR", region: null, mentorLevel: null },
        },
      },
    }),
    db.category.findMany({ orderBy: { sort: "asc" } }),
  ]);

  // Netflix-style browse: category rows when exploring everything; a plain
  // results grid once the learner searches or narrows to a tier.
  const grouped = !filtered
    ? categories
        .map((c) => ({
          category: c,
          projects: projects.filter((p) => p.categoryId === c.id),
        }))
        .filter((g) => g.projects.length > 0)
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-3">
          <SectionEyebrow tone="distinction">Build</SectionEyebrow>
          <SectionHeading as="h1">
            Projects that read like real tickets
          </SectionHeading>
          <p className="max-w-2xl text-muted-foreground">
            Take-home-assessment-scale briefs, rubric-graded by real mentors.
            Buy one project — no bootcamp commitment.
          </p>
        </div>
        <form className="w-full max-w-sm" action="/projects">
          <Input
            name="q"
            placeholder="Search projects…"
            defaultValue={q}
            className="rounded-full"
          />
        </form>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {TIERS.map(([value, label]) => (
          <Link
            key={value || "all"}
            href={value ? `/projects?tier=${value}` : "/projects"}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors",
              tier === value || (!tier && !value)
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/60",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <p className="mt-12 text-muted-foreground">No projects match.</p>
      ) : filtered ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={toProjectCardData(project)} />
          ))}
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          <CarouselRow title="Most purchased">
            {projects.slice(0, 12).map((project) => (
              <CarouselItem key={project.id}>
                <ProjectCard project={toProjectCardData(project)} />
              </CarouselItem>
            ))}
          </CarouselRow>
          {grouped.map((g) => (
            <CarouselRow
              key={g.category.id}
              title={g.category.name}
              href={`/projects?category=${g.category.slug}`}
            >
              {g.projects.map((project) => (
                <CarouselItem key={project.id}>
                  <ProjectCard project={toProjectCardData(project)} />
                </CarouselItem>
              ))}
            </CarouselRow>
          ))}
        </div>
      )}
    </div>
  );
}
