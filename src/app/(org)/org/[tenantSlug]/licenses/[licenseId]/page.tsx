import Link from "next/link";
import { notFound } from "next/navigation";

import { StatCard } from "@/components/dashboard/stat-card";
import { Pill, type PillTone } from "@/components/shared";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { poolBalanceMinor } from "@/lib/enterprise/credit-math";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "License" };

const LICENSE_STATUS_TONE: Record<string, PillTone> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  EXPIRED: "distinction",
  CANCELLED: "destructive",
};

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
          <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
            {license.kind === "CREDIT_POOL"
              ? "Credit pool"
              : license.kind === "PROGRAM"
                ? `Program license — ${license.program?.title}`
                : "Catalog seat license"}
          </h1>
          <Pill tone={LICENSE_STATUS_TONE[license.status] ?? "neutral"}>
            {license.status.toLowerCase()}
          </Pill>
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
            <StatCard
              icon="earnings"
              label="Pool"
              value={formatMoney(license.contractValueMinor ?? 0n)}
              tone="primary"
            />
            <StatCard
              icon="earnings"
              label="Consumed"
              value={formatMoney(consumed)}
              tone="distinction"
            />
            <StatCard
              icon="earnings"
              label="Balance"
              value={formatMoney(poolBalanceMinor(license.contractValueMinor ?? 0n, consumed))}
              tone="success"
            />
          </>
        ) : (
          <>
            <StatCard
              icon="roster"
              label="Seats"
              value={`${license.seatsAssigned.filter((s) => s.status !== "REVOKED").length} / ${license.seats}`}
              tone="info"
            />
            {license.kind === "CATALOG" && (
              <StatCard
                icon="licenses"
                label="Catalog scope"
                value={scope.courseIds?.length ? `${scope.courseIds.length} courses` : "Full catalog"}
                tone="neutral"
              />
            )}
          </>
        )}
        <StatCard
          icon="earnings"
          label="Contract value"
          value={license.contractValueMinor ? formatMoney(license.contractValueMinor) : "—"}
          tone="primary"
        />
      </div>

      {license.kind === "CREDIT_POOL" && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-base font-extrabold">Consumption ledger</div>
          <div className="mt-4 space-y-2 text-sm">
            {license.consumptions.length === 0 ? (
              <p className="text-muted-foreground">No redemptions yet.</p>
            ) : (
              license.consumptions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                >
                  <div>
                    <span className="font-bold">
                      {c.course?.title ?? c.project?.title}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {c.user.name} ·{" "}
                      {c.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </span>
                  </div>
                  <span className="font-bold">−{formatMoney(c.amountMinor)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-base font-extrabold">Payments</div>
        <div className="mt-4 space-y-2 text-sm">
          {license.payments.length === 0 ? (
            <p className="text-muted-foreground">
              No payments recorded — the platform records contract payments,
              which activates the license.
            </p>
          ) : (
            license.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
              >
                <span className="text-muted-foreground">
                  {p.providerPaymentRef} ·{" "}
                  {p.capturedAt?.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </span>
                <span className="font-bold">{formatMoney(p.amountMinor)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
