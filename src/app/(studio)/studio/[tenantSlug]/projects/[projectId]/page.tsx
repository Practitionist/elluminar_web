import { notFound } from "next/navigation";

import { Pill, type PillTone } from "@/components/shared";
import { requireStudioTenant } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tiptapToPlainText } from "@/lib/richtext";

import { ProjectEditorForms } from "./project-editor-forms";

export const metadata = { title: "Edit project" };

const STATUS_TONE: Record<string, PillTone> = {
  PUBLISHED: "success",
  IN_REVIEW: "distinction",
  DRAFT: "neutral",
  UNLISTED: "neutral",
  ARCHIVED: "neutral",
};

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; projectId: string }>;
}) {
  const { tenantSlug, projectId } = await params;
  const { tenant } = await requireStudioTenant(tenantSlug, ["owner", "admin", "instructor"]);

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      milestones: { orderBy: { position: "asc" } },
      rubric: { include: { criteria: { orderBy: { position: "asc" } } } },
      prices: { where: { currency: "INR", region: null, active: true } },
    },
  });
  if (!project || project.tenantId !== tenant.id) notFound();

  const basePrice = project.prices.find((p) => p.mentorLevel === null);
  const seniorPrice = project.prices.find((p) => p.mentorLevel === "SENIOR");
  const principalPrice = project.prices.find((p) => p.mentorLevel === "PRINCIPAL");

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          {project.title}
        </h1>
        <Pill tone="distinction">{project.tier.toLowerCase()}</Pill>
        <Pill tone={STATUS_TONE[project.status] ?? "neutral"}>
          {project.status.toLowerCase().replace("_", " ")}
        </Pill>
      </div>

      <ProjectEditorForms
        tenantSlug={tenantSlug}
        projectId={project.id}
        status={project.status}
        defaults={{
          title: project.title,
          summary: project.summary,
          brief: tiptapToPlainText(project.brief),
          techStack: project.techStack.join(", "),
          visibility: project.visibility,
          baseRupees: basePrice ? Number(basePrice.amountMinor) / 100 : null,
          seniorRupees: seniorPrice ? Number(seniorPrice.amountMinor) / 100 : null,
          principalRupees: principalPrice ? Number(principalPrice.amountMinor) / 100 : null,
        }}
      />

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-base font-extrabold">Milestones & rubric</div>
        <div className="mt-4 space-y-2 text-sm">
          {project.milestones.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5"
            >
              <span className="font-semibold">
                {i + 1}. {m.title}
              </span>
              <span className="flex gap-2">
                {m.expectedWeek && <Pill tone="neutral">week {m.expectedWeek}</Pill>}
                {m.isReviewCheckpoint && <Pill tone="primary">checkpoint</Pill>}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {project.rubric.criteria.map((c) => (
            <div key={c.id} className="rounded-xl border border-border px-3 py-2.5">
              <div className="text-sm font-bold">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.weightPct}% weight</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
