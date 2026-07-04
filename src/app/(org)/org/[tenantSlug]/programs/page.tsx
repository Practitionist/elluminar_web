import Link from "next/link";

import { Pill, type PillTone } from "@/components/shared";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { ProgramFormDialog } from "./program-form-dialog";

export const metadata = { title: "Programs" };

const PROGRAM_STATUS_TONE: Record<string, PillTone> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  ARCHIVED: "neutral",
};

export default async function OrgProgramsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin"]);

  const programs = await db.program.findMany({
    where: { ownerTenantId: tenant.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { items: true, cohorts: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
            Programs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Curated course sequences + optional mentor capstones, delivered in
            cohorts with a co-branded certificate.
          </p>
        </div>
        <ProgramFormDialog tenantSlug={tenantSlug} />
      </div>
      {programs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
          No programs yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) => (
            <Link
              key={p.id}
              href={`/org/${tenantSlug}/programs/${p.id}`}
              className="rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-base font-extrabold">{p.title}</div>
                <Pill tone={PROGRAM_STATUS_TONE[p.status] ?? "neutral"}>
                  {p.status.toLowerCase()}
                </Pill>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {p._count.items} items · {p._count.cohorts} cohorts
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
