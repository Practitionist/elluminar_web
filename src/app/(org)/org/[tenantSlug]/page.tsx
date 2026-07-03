import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tenantLabels } from "@/lib/enterprise/labels";
import { formatMoney } from "@/lib/money";
import { poolBalanceMinor } from "@/lib/enterprise/credit-math";

export const metadata = { title: "Organization overview" };

export default async function OrgOverviewPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug);
  const labels = tenantLabels(tenant.type);

  const [licenses, memberCount, programCount, activeCohorts] = await Promise.all([
    db.orgLicense.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      include: {
        seatsAssigned: { where: { status: { in: ["INVITED", "ACTIVATED"] } } },
        consumptions: { select: { amountMinor: true } },
      },
    }),
    db.member.count({ where: { organizationId: tenant.organizationId } }),
    db.program.count({ where: { ownerTenantId: tenant.id } }),
    db.programCohort.count({
      where: { program: { ownerTenantId: tenant.id }, status: { in: ["OPEN", "RUNNING"] } },
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

  const stats = [
    { label: "Active licenses", value: String(licenses.length) },
    { label: "Seats used / licensed", value: `${seatsUsed} / ${seatsLicensed}` },
    ...(pools.length > 0
      ? [{ label: "Credit balance", value: formatMoney(poolBalance) }]
      : []),
    { label: labels.members, value: String(memberCount) },
    { label: "Programs", value: String(programCount) },
    { label: "Active cohorts", value: String(activeCohorts) },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Getting started</CardTitle>
          <CardDescription>
            1. Create a license (seats or credit pool) · 2. Import your{" "}
            {labels.members.toLowerCase()} roster · 3. Build a program and enroll
            a cohort · 4. Track completion in Reports.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
