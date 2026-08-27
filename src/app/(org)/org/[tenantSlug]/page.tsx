import { StatCard } from "@/components/dashboard/stat-card";
import type { PillTone } from "@/components/shared";
import { requireOrgTenant } from "@/lib/auth/session";
import { poolBalanceMinor } from "@/lib/enterprise/credit-math";
import { tenantLabels } from "@/lib/enterprise/labels";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Organization overview" };

export default async function OrgOverviewPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireOrgTenant(tenantSlug);
  const labels = tenantLabels(tenant.type);

  const [licenses, memberCount, programCount, activeCohorts] =
    await Promise.all([
      db.orgLicense.findMany({
        where: { tenantId: tenant.id, status: "ACTIVE" },
        include: {
          seatsAssigned: {
            where: { status: { in: ["INVITED", "ACTIVATED"] } },
          },
          consumptions: { select: { amountMinor: true } },
        },
      }),
      db.member.count({ where: { organizationId: tenant.organizationId } }),
      db.program.count({ where: { ownerTenantId: tenant.id } }),
      db.programCohort.count({
        where: {
          program: { ownerTenantId: tenant.id },
          status: { in: ["OPEN", "RUNNING"] },
        },
      }),
    ]);

  const seatLicenses = licenses.filter((l) => l.kind !== "CREDIT_POOL");
  const seatsLicensed = seatLicenses.reduce((s, l) => s + l.seats, 0);
  const seatsUsed = seatLicenses.reduce((s, l) => s + l.seatsAssigned.length, 0);
  const pools = licenses.filter((l) => l.kind === "CREDIT_POOL");
  const poolBalance = pools.reduce(
    (s, l) =>
      s +
      poolBalanceMinor(
        l.contractValueMinor ?? 0n,
        l.consumptions.reduce((c, r) => c + r.amountMinor, 0n),
      ),
    0n,
  );

  const stats: {
    label: string;
    value: string;
    icon: string;
    tone: PillTone;
  }[] = [
    {
      label: "Active licenses",
      value: String(licenses.length),
      icon: "licenses",
      tone: "primary",
    },
    {
      label: "Seats used / licensed",
      value: `${seatsUsed} / ${seatsLicensed}`,
      icon: "roster",
      tone: "info",
    },
    ...(pools.length > 0
      ? [
          {
            label: "Credit balance",
            value: formatMoney(poolBalance),
            icon: "earnings",
            tone: "success" as PillTone,
          },
        ]
      : []),
    {
      label: labels.members,
      value: String(memberCount),
      icon: "community",
      tone: "distinction",
    },
    {
      label: "Programs",
      value: String(programCount),
      icon: "programs",
      tone: "primary",
    },
    {
      label: "Active cohorts",
      value: String(activeCohorts),
      icon: "cohorts",
      tone: "info",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        Overview
      </h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-sm font-extrabold">Getting started</div>
        <p className="mt-2 text-sm text-muted-foreground">
          1. Create a license (seats or credit pool) · 2. Import your{" "}
          {labels.members.toLowerCase()} roster · 3. Build a program and enroll a
          cohort · 4. Track completion in Reports.
        </p>
      </div>
    </div>
  );
}
