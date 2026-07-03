import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <h1 className="text-2xl font-semibold tracking-tight">Earnings</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Available balance</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(account?.balanceCachedMinor ?? 0n)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gross sales</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(totals._sum.totalMinor ?? 0n)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net earnings</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(totals._sum.sellerEarningsMinor ?? 0n)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Items sold</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{totals._count}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Ledger</h2>
        <p className="text-xs text-muted-foreground">
          Commission: {(tenant.commissionBps / 100).toFixed(0)}% ({tenant.creatorPlan
            .toLowerCase()
            .replace("_", " ")}{" "}
          plan). Payouts are processed against this balance.
        </p>
        <div className="mt-3 space-y-1.5 text-sm">
          {!account || account.entries.length === 0 ? (
            <p className="text-muted-foreground">No entries yet — they appear on your first sale.</p>
          ) : (
            account.entries.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div>
                  <Badge variant="outline">{ENTRY_LABEL[e.entryType] ?? e.entryType}</Badge>
                  <span className="ml-2 text-muted-foreground">{e.memo}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      e.amountMinor < 0n ? "font-medium text-destructive" : "font-medium"
                    }
                  >
                    {e.amountMinor < 0n ? "−" : "+"}
                    {formatMoney(e.amountMinor < 0n ? -e.amountMinor : e.amountMinor)}
                  </span>
                  <span className="text-xs text-muted-foreground">
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
