import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { poolBalanceMinor } from "@/lib/enterprise/credit-math";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "License" };

export default async function LicenseDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; licenseId: string }>;
}) {
  const { tenantSlug, licenseId } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin"]);

  const license = await db.orgLicense.findUnique({
    where: { id: licenseId },
    include: {
      program: { select: { title: true } },
      payments: { orderBy: { createdAt: "desc" } },
      seatsAssigned: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { assignedAt: "desc" },
      },
      consumptions: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true } },
          course: { select: { title: true } },
          project: { select: { title: true } },
        },
      },
    },
  });
  if (!license || license.tenantId !== tenant.id) notFound();

  const consumed = license.consumptions.reduce((s, c) => s + c.amountMinor, 0n);
  const scope = (license.catalogScope ?? {}) as { courseIds?: string[] };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/org/${tenantSlug}/licenses`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Licenses
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {license.kind === "CREDIT_POOL"
              ? "Credit pool"
              : license.kind === "PROGRAM"
                ? `Program license — ${license.program?.title}`
                : "Catalog seat license"}
          </h1>
          <Badge variant={license.status === "ACTIVE" ? "default" : "secondary"}>
            {license.status.toLowerCase()}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {license.startsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })} →{" "}
          {license.endsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
          {license.contractRef ? ` · ${license.contractRef}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {license.kind === "CREDIT_POOL" ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pool</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatMoney(license.contractValueMinor ?? 0n)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Consumed</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{formatMoney(consumed)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Balance</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatMoney(poolBalanceMinor(license.contractValueMinor ?? 0n, consumed))}
                </CardTitle>
              </CardHeader>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Seats</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {license.seatsAssigned.filter((s) => s.status !== "REVOKED").length} /{" "}
                  {license.seats}
                </CardTitle>
              </CardHeader>
            </Card>
            {license.kind === "CATALOG" && (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Catalog scope</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {scope.courseIds?.length ? `${scope.courseIds.length} courses` : "Full catalog"}
                  </CardTitle>
                </CardHeader>
              </Card>
            )}
          </>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Contract value</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {license.contractValueMinor ? formatMoney(license.contractValueMinor) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {license.kind === "CREDIT_POOL" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consumption ledger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {license.consumptions.length === 0 ? (
              <p className="text-muted-foreground">No redemptions yet.</p>
            ) : (
              license.consumptions.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <span className="font-medium">
                      {c.course?.title ?? c.project?.title}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {c.user.name} ·{" "}
                      {c.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </span>
                  </div>
                  <span className="font-medium">−{formatMoney(c.amountMinor)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {license.payments.length === 0 ? (
            <p className="text-muted-foreground">
              No payments recorded — the platform records contract payments,
              which activates the license.
            </p>
          ) : (
            license.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-muted-foreground">
                  {p.providerPaymentRef} ·{" "}
                  {p.capturedAt?.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </span>
                <span className="font-medium">{formatMoney(p.amountMinor)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
