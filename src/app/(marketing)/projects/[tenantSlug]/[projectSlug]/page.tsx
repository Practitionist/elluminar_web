import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/catalog/add-to-cart-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
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

  const basePrice = project.prices.find((p) => p.mentorLevel === null);
  const levelPrices = project.prices.filter((p) => p.mentorLevel !== null);
  const brief = tiptapToPlainText(project.brief);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{project.tier.toLowerCase()}</Badge>
            <Badge variant="outline">
              {project.durationWeeksMin}–{project.durationWeeksMax} weeks
            </Badge>
            <Badge variant="outline">~{Number(project.mentorHoursBudget)}h mentor time</Badge>
            {project.defenseRequired && <Badge variant="secondary">live defense</Badge>}
            {project.partnerCompanyName && (
              <Badge variant="secondary">brief by {project.partnerCompanyName}</Badge>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{project.title}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{project.summary}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            By{" "}
            <Link href={`/c/${project.tenant.slug}`} className="font-medium hover:underline">
              {project.tenant.displayName}
            </Link>
          </p>

          {project.techStack.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {project.techStack.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
          )}

          {brief && (
            <>
              <h2 className="mt-8 text-xl font-semibold">The brief</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-6">{brief}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Deliberately ambiguous — you make and justify the tradeoffs. Your work
                is checked against a held-out evaluation you can&apos;t see in advance.
              </p>
            </>
          )}

          <h2 className="mt-8 text-xl font-semibold">Milestones & mentor checkpoints</h2>
          <div className="mt-3 space-y-3">
            {project.milestones.map((m, i) => (
              <Card key={m.id}>
                <CardHeader className="py-3">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span>
                      {i + 1}. {m.title}
                    </span>
                    <span className="flex gap-2">
                      {m.expectedWeek && (
                        <Badge variant="outline">week {m.expectedWeek}</Badge>
                      )}
                      {m.isReviewCheckpoint && <Badge>mentor review</Badge>}
                    </span>
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <h2 className="mt-8 text-xl font-semibold">How you&apos;re graded</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {project.rubric.criteria.map((c) => (
              <Card key={c.id}>
                <CardContent className="pt-4">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.weightPct}% weight</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buy this project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-3xl font-semibold">
                  {basePrice ? formatMoney(basePrice.amountMinor) : "—"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Includes mentor review at every checkpoint
                  {project.defenseRequired ? " + live defense" : ""}.
                </p>
              </div>
              <AddToCartButton itemType="PROJECT" projectId={project.id} label="Add to cart" />
              {levelPrices.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Choose a more senior reviewer:
                  </p>
                  {levelPrices.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm">
                        {LEVEL_LABELS[p.mentorLevel!] ?? p.mentorLevel}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {formatMoney(p.amountMinor)}
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
              )}
              <p className="text-xs text-muted-foreground">
                Fully refundable until your mentor kickoff call.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
