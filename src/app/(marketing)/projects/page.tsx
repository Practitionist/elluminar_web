import Link from "next/link";

import {
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
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={toProjectCardData(project)} />
          ))}
        </div>
      )}
    </div>
  );
}
