import Link from "next/link";

import { Pill, type PillTone } from "@/components/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { poolBalanceMinor } from "@/lib/enterprise/credit-math";
import { formatMoney } from "@/lib/money";

import { CreateLicenseDialog } from "./create-license-dialog";

export const metadata = { title: "Licenses" };

const LICENSE_STATUS_TONE: Record<string, PillTone> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  EXPIRED: "distinction",
  CANCELLED: "destructive",
};

export default async function OrgLicensesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin"]);

  const [licenses, programs, courses] = await Promise.all([
    db.orgLicense.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      include: {
        program: { select: { title: true } },
        seatsAssigned: { where: { status: { in: ["INVITED", "ACTIVATED"] } } },
        consumptions: { select: { amountMinor: true } },
      },
    }),
    db.program.findMany({
      where: { ownerTenantId: tenant.id },
      select: { id: true, title: true },
    }),
    db.course.findMany({
      where: { status: "PUBLISHED", visibility: "MARKETPLACE" },
      select: { id: true, title: true },
      orderBy: { enrollmentCount: "desc" },
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Licenses
        </h1>
        <CreateLicenseDialog
          tenantSlug={tenantSlug}
          programs={programs}
          courses={courses}
        />
      </div>
      {licenses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
          No licenses yet. Create one — it activates once the platform records
          your contract payment.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Capacity / balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses.map((l) => {
                const consumed = l.consumptions.reduce((s, c) => s + c.amountMinor, 0n);
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link
                        href={`/org/${tenantSlug}/licenses/${l.id}`}
                        className="font-semibold hover:underline"
                      >
                        {l.kind === "CREDIT_POOL"
                          ? "Credit pool"
                          : l.kind === "PROGRAM"
                            ? `Program: ${l.program?.title ?? "—"}`
                            : "Catalog seats"}
                      </Link>
                      {l.contractRef && (
                        <div className="text-xs text-muted-foreground">{l.contractRef}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.startsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })} →{" "}
                      {l.endsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.kind === "CREDIT_POOL"
                        ? `${formatMoney(poolBalanceMinor(l.contractValueMinor ?? 0n, consumed))} left of ${formatMoney(l.contractValueMinor ?? 0n)}`
                        : `${l.seatsAssigned.length} / ${l.seats} seats`}
                    </TableCell>
                    <TableCell>
                      <Pill tone={LICENSE_STATUS_TONE[l.status] ?? "neutral"}>
                        {l.status.toLowerCase()}
                      </Pill>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
