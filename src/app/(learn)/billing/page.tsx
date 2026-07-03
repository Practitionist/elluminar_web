import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getActiveSubscriptionWithPlan } from "@/lib/commerce/entitlements";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

import { CancelSubscriptionButton } from "./cancel-subscription-button";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const session = await requireUser("/billing");
  const sub = await getActiveSubscriptionWithPlan(session.user.id);

  const payments = await db.payment.findMany({
    where: {
      status: "CAPTURED",
      OR: [{ order: { userId: session.user.id } }, { subscription: { userId: session.user.id } }],
    },
    orderBy: { capturedAt: "desc" },
    take: 20,
    include: { invoices: { where: { kind: "TAX_INVOICE" } }, order: true, subscription: { include: { plan: true } } },
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membership</CardTitle>
          <CardDescription>
            Memberships add breadth and mentor benefits — à la carte purchases are never gated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sub ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xl font-semibold">{sub.plan.name}</span>
                <Badge
                  variant={
                    sub.status === "ACTIVE" || sub.status === "TRIALING"
                      ? "default"
                      : "secondary"
                  }
                >
                  {sub.status.toLowerCase().replace("_", " ")}
                </Badge>
                {sub.cancelAtPeriodEnd && (
                  <Badge variant="outline">ends at period close</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {sub.interval === "MONTHLY" ? "Monthly" : "Annual"} billing
                {sub.currentPeriodEnd
                  ? ` · renews ${sub.currentPeriodEnd.toLocaleDateString("en-IN", { dateStyle: "medium" })}`
                  : ""}
              </p>
              {sub.credits.length > 0 && (
                <div className="text-sm">
                  <p className="font-medium">Project credits</p>
                  {sub.credits.slice(0, 4).map((c) => (
                    <p key={c.id} className="text-muted-foreground">
                      {c.creditType === "SPRINT_PROJECT" ? "Sprint" : "Flagship"} ·{" "}
                      {c.periodKey}: {c.grantedCount - c.usedCount} of {c.grantedCount} left
                    </p>
                  ))}
                </div>
              )}
              {!sub.cancelAtPeriodEnd && (
                <CancelSubscriptionButton subscriptionId={sub.id} />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                You&apos;re on the Free tier — everything à la carte.
              </p>
              <Button render={<Link href="/pricing" />}>See memberships</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment history</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {p.order
                        ? `Order #${p.order.orderNo}`
                        : `${p.subscription?.plan.name ?? "Membership"} renewal`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.capturedAt?.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                      {p.invoices[0] ? ` · ${p.invoices[0].number}` : ""}
                    </div>
                  </div>
                  <span className="font-medium">{formatMoney(p.amountMinor)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
