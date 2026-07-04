import { StatCard } from "@/components/dashboard/stat-card";
import { Pill } from "@/components/shared";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Earnings" };

const ENTRY_LABEL: Record<string, string> = {
  SALE_EARNING: "Sale",
  REFUND_REVERSAL: "Refund clawback",
  MENTOR_FEE: "Mentor fee",
  PAYOUT: "Payout",
  ADJUSTMENT: "Adjustment",
};

export default async function EarningsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin"]);

  const account = await db.ledgerAccount.findFirst({
    where: { ownerType: "TENANT", tenantId: tenant.id, currency: "INR" },
    include: {
      entries: { orderBy: { createdAt: "desc" }, take: 50 },
      payouts: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  const totals = await db.orderItem.aggregate({
    where: { sellerTenantId: tenant.id, fulfillmentStatus: "FULFILLED" },
    _sum: { totalMinor: true, sellerEarningsMinor: true },
    _count: true,
  });

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        Earnings
      </h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon="earnings"
          label="Available balance"
          value={formatMoney(account?.balanceCachedMinor ?? 0n)}
          tone="primary"
        />
        <StatCard
          icon="billing"
          label="Gross sales"
          value={formatMoney(totals._sum.totalMinor ?? 0n)}
          tone="info"
        />
        <StatCard
          icon="payouts"
          label="Net earnings"
          value={formatMoney(totals._sum.sellerEarningsMinor ?? 0n)}
          tone="success"
        />
        <StatCard icon="orders" label="Items sold" value={totals._count} tone="distinction" />
      </div>

      <div>
        <div className="text-base font-extrabold">Ledger</div>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          Commission: {(tenant.commissionBps / 100).toFixed(0)}% ({tenant.creatorPlan
            .toLowerCase()
            .replace("_", " ")}{" "}
          plan). Payouts are processed against this balance.
        </p>
        <div className="mt-4 space-y-2">
          {!account || account.entries.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No entries yet — they appear on your first sale.
            </div>
          ) : (
            account.entries.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Pill tone="neutral">{ENTRY_LABEL[e.entryType] ?? e.entryType}</Pill>
                  <span className="text-muted-foreground">{e.memo}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      e.amountMinor < 0n
                        ? "font-bold text-destructive"
                        : "font-bold text-success-subtle-foreground"
                    }
                  >
                    {e.amountMinor < 0n ? "−" : "+"}
                    {formatMoney(e.amountMinor < 0n ? -e.amountMinor : e.amountMinor)}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {e.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
