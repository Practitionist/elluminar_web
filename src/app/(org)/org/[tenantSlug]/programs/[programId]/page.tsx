import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tiptapToPlainText } from "@/lib/richtext";

import { ProgramBuilder } from "./program-builder";
import { ProgramCohortsPanel } from "./program-cohorts-panel";
import { ProgramFormDialog } from "../program-form-dialog";
import { ProgramStatusButton } from "./program-status-button";

export const metadata = { title: "Program builder" };

export default async function ProgramBuilderPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; programId: string }>;
}) {
  const { tenantSlug, programId } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin"]);

  const program = await db.program.findUnique({
    where: { id: programId },
    include: {
      certificateTemplate: true,
      items: {
        orderBy: { position: "asc" },
        include: {
          course: { select: { title: true } },
          project: { select: { title: true, tier: true } },
        },
      },
      cohorts: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { enrollments: true } } },
      },
      licenses: {
        where: { status: "ACTIVE" },
        include: {
          seatsAssigned: {
            where: { status: "ACTIVATED" },
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
  if (!program || program.ownerTenantId !== tenant.id) notFound();

  const [courses, projects] = await Promise.all([
    db.course.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, title: true },
      orderBy: { enrollmentCount: "desc" },
      take: 200,
    }),
    db.project.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, title: true, tier: true },
      orderBy: { purchaseCount: "desc" },
      take: 200,
    }),
  ]);

  const coBrand = (program.certificateTemplate?.coBrand ?? {}) as { partnerName?: string };
  const activatedSeats = program.licenses.flatMap((l) =>
    l.seatsAssigned.map((s) => ({
      id: s.id,
      label: `${s.user?.name ?? s.inviteEmail} (${s.user?.email ?? "invited"})`,
    })),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/org/${tenantSlug}/programs`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Programs
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{program.title}</h1>
            <Badge variant={program.status === "ACTIVE" ? "default" : "outline"}>
              {program.status.toLowerCase()}
            </Badge>
          </div>
          {coBrand.partnerName && (
            <p className="text-sm text-muted-foreground">
              Certificate co-branded with {coBrand.partnerName}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <ProgramFormDialog
            tenantSlug={tenantSlug}
            program={{
              id: program.id,
              title: program.title,
              slug: program.slug,
              description: tiptapToPlainText(program.description),
              coBrandPartnerName: coBrand.partnerName ?? "",
            }}
          />
          <ProgramStatusButton
            tenantSlug={tenantSlug}
            programId={program.id}
            status={program.status}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sequence</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgramBuilder
            tenantSlug={tenantSlug}
            programId={program.id}
            items={program.items.map((i) => ({
              id: i.id,
              itemType: i.itemType,
              title:
                i.itemType === "COURSE"
                  ? (i.course?.title ?? "—")
                  : `${i.project?.title ?? "—"} (${i.project?.tier.toLowerCase()})`,
              required: i.required,
              unlockAfterItemId: i.unlockAfterItemId,
            }))}
            courses={courses}
            projects={projects.map((p) => ({
              id: p.id,
              title: `${p.title} (${p.tier.toLowerCase()})`,
            }))}
          />
        </CardContent>
      </Card>

      <ProgramCohortsPanel
        tenantSlug={tenantSlug}
        programId={program.id}
        cohorts={program.cohorts.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          startsAt: c.startsAt?.toISOString() ?? null,
          endsAt: c.endsAt?.toISOString() ?? null,
          capacity: c.capacity,
          enrolled: c._count.enrollments,
        }))}
        activatedSeats={activatedSeats}
      />
    </div>
  );
}
