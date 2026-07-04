import type { Metadata } from "next";
import { CircleDot } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/catalog/add-to-cart-button";
import { GradientThumb, Pill } from "@/components/shared";
import { db } from "@/lib/db";
import { priceDisplay } from "@/lib/ui/price";
import { cn } from "@/lib/utils";
import { tiptapToPlainText } from "@/lib/richtext";

async function loadProject(tenantSlug: string, projectSlug: string) {
  const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return null;
  const project = await db.project.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug: projectSlug } },
    include: {
      tenant: { select: { slug: true, displayName: true } },
      milestones: { orderBy: { position: "asc" } },
      rubric: { include: { criteria: { orderBy: { position: "asc" } } } },
      prices: { where: { active: true, currency: "INR", region: null } },
      reviews: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!project || project.status !== "PUBLISHED") return null;
  return project;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string; projectSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug, projectSlug } = await params;
  const project = await loadProject(tenantSlug, projectSlug);
  if (!project) return {};
  return { title: project.title, description: project.summary };
}

const LEVEL_LABELS: Record<string, string> = {
  ASSOCIATE: "Associate mentor",
  SENIOR: "Senior mentor",
  PRINCIPAL: "Principal mentor",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; projectSlug: string }>;
}) {
  const { tenantSlug, projectSlug } = await params;
  const project = await loadProject(tenantSlug, projectSlug);
  if (!project) notFound();

  const basePrice = priceDisplay(
    project.prices.find((p) => p.mentorLevel === null) ?? null,
  );
  const levelPrices = project.prices.filter((p) => p.mentorLevel !== null);
  const brief = tiptapToPlainText(project.brief);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="distinction">{project.tier.toLowerCase()}</Pill>
            <Pill tone="neutral">
              {project.durationWeeksMin}–{project.durationWeeksMax} weeks
            </Pill>
            <Pill tone="neutral">
              ~{Number(project.mentorHoursBudget)}h mentor time
            </Pill>
            {project.defenseRequired ? (
              <Pill tone="info">Live defense</Pill>
            ) : null}
            {project.partnerCompanyName ? (
              <Pill tone="primary">brief by {project.partnerCompanyName}</Pill>
            ) : null}
          </div>
          <h1 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
            {project.title}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">{project.summary}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            By{" "}
            <Link
              href={`/c/${project.tenant.slug}`}
              className="font-semibold text-foreground hover:underline"
            >
              {project.tenant.displayName}
            </Link>
          </p>

          {project.techStack.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {project.techStack.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs font-semibold text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}

          {brief ? (
            <>
              <h2 className="mt-10 font-display text-2xl font-medium tracking-tight">
                The brief
              </h2>
              <p className="mt-3 leading-7 whitespace-pre-line text-foreground/90">
                {brief}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Deliberately ambiguous — you make and justify the tradeoffs. Your
                work is checked against a held-out evaluation you can&apos;t see
                in advance.
              </p>
            </>
          ) : null}

          <h2 className="mt-10 font-display text-2xl font-medium tracking-tight">
            Milestones &amp; mentor checkpoints
          </h2>
          <div className="mt-4 space-y-3">
            {project.milestones.map((m, i) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4"
              >
                <span className="flex items-center gap-3 text-sm font-bold">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-xs font-extrabold text-primary-subtle-foreground">
                    {i + 1}
                  </span>
                  {m.title}
                </span>
                <span className="flex shrink-0 gap-2">
                  {m.expectedWeek ? (
                    <Pill tone="neutral" className="px-2 py-0.5 text-[10px]">
                      week {m.expectedWeek}
                    </Pill>
                  ) : null}
                  {m.isReviewCheckpoint ? (
                    <Pill tone="success" className="px-2 py-0.5 text-[10px]">
                      mentor review
                    </Pill>
                  ) : null}
                </span>
              </div>
            ))}
          </div>

          <h2 className="mt-10 font-display text-2xl font-medium tracking-tight">
            How you&apos;re graded
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {project.rubric.criteria.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <CircleDot className="size-4 text-primary" />
                <div className="mt-2 text-sm font-extrabold">{c.name}</div>
                <div className="text-xs font-semibold text-muted-foreground">
                  {c.weightPct}% weight
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside>
          <div className="sticky top-20 overflow-hidden rounded-2xl border border-border bg-card">
            <GradientThumb keyer={project.slug} variant="dark" className="h-24" />
            <div className="space-y-4 p-5">
              <div>
                <div
                  className={cn(
                    "text-3xl font-extrabold tracking-tight",
                    basePrice.isFree && "text-success-subtle-foreground",
                  )}
                >
                  {basePrice.label}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Includes mentor review at every checkpoint
                  {project.defenseRequired ? " + live defense" : ""}.
                </p>
              </div>
              <AddToCartButton
                itemType="PROJECT"
                projectId={project.id}
                label="Add to cart"
              />
              {levelPrices.length > 0 ? (
                <div className="space-y-2.5 border-t border-border pt-4">
                  <p className="text-xs font-bold text-muted-foreground">
                    Choose a more senior reviewer:
                  </p>
                  {levelPrices.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-sm font-semibold">
                        {LEVEL_LABELS[p.mentorLevel!] ?? p.mentorLevel}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold">
                          {priceDisplay(p).label}
                        </span>
                        <AddToCartButton
                          itemType="PROJECT"
                          projectId={project.id}
                          mentorLevel={p.mentorLevel as never}
                          label="Add"
                          variant="outline"
                          size="sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Fully refundable until your mentor kickoff call.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
