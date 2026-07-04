import Link from "next/link";
import { notFound } from "next/navigation";

import { Pill, type PillTone } from "@/components/shared";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tiptapToPlainText } from "@/lib/richtext";

import { ProgramBuilder } from "./program-builder";
import { ProgramCohortsPanel } from "./program-cohorts-panel";
import { ProgramFormDialog } from "../program-form-dialog";
import { ProgramStatusButton } from "./program-status-button";

export const metadata = { title: "Program builder" };

const PROGRAM_STATUS_TONE: Record<string, PillTone> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  ARCHIVED: "neutral",
};

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
            <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
              {program.title}
            </h1>
            <Pill tone={PROGRAM_STATUS_TONE[program.status] ?? "neutral"}>
              {program.status.toLowerCase()}
            </Pill>
          </div>
          {coBrand.partnerName && (
            <p className="mt-1 text-sm text-muted-foreground">
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

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-base font-extrabold">Sequence</div>
        <div className="mt-4">
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
        </div>
      </div>

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
