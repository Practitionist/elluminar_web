import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tiptapToPlainText } from "@/lib/richtext";

import { ProjectEditorForms } from "./project-editor-forms";

export const metadata = { title: "Edit project" };

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; projectId: string }>;
}) {
  const { tenantSlug, projectId } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin", "instructor"]);

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
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
        <Badge>{project.tier.toLowerCase()}</Badge>
        <Badge variant="outline">{project.status.toLowerCase().replace("_", " ")}</Badge>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Milestones & rubric</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {project.milestones.map((m, i) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>
                {i + 1}. {m.title}
              </span>
              <span className="flex gap-2">
                {m.expectedWeek && <Badge variant="outline">week {m.expectedWeek}</Badge>}
                {m.isReviewCheckpoint && <Badge variant="secondary">checkpoint</Badge>}
              </span>
            </div>
          ))}
          <div className="grid gap-2 pt-2 sm:grid-cols-3">
            {project.rubric.criteria.map((c) => (
              <div key={c.id} className="rounded-md border px-3 py-2">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.weightPct}% weight</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
