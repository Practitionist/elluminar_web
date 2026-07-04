import { Pill, type PillTone } from "@/components/shared";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

import { RequestRefundButton } from "./request-refund-button";

export const metadata = { title: "Orders & refunds" };

const ORDER_STATUS_TONE: Record<string, PillTone> = {
  PAID: "success",
  PENDING_PAYMENT: "distinction",
  PARTIALLY_REFUNDED: "neutral",
  REFUNDED: "neutral",
  FAILED: "destructive",
  CANCELLED: "destructive",
  EXPIRED: "destructive",
};

const REFUND_STATUS_TONE: Record<string, PillTone> = {
  REQUESTED: "distinction",
  APPROVED: "info",
  PROCESSING: "distinction",
  PROCESSED: "success",
  REJECTED: "destructive",
  FAILED: "destructive",
};

export default async function OrdersPage() {
  const session = await requireUser("/learn/orders");

  const orders = await db.order.findMany({
    where: { userId: session.user.id, status: { not: "DRAFT" } },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          refunds: { orderBy: { createdAt: "desc" } },
          projectInstances: { select: { status: true, mentorKickoffAt: true } },
        },
      },
    },
  });

  if (orders.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
          No orders yet — your purchases will appear here.
        </div>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        Orders & refunds
      </h1>
      {orders.map((order) => (
        <div key={order.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-base font-extrabold">Order #{order.orderNo}</span>
              <span className="ml-2 text-sm font-semibold text-muted-foreground">
                {order.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Pill tone={ORDER_STATUS_TONE[order.status] ?? "neutral"}>
                {order.status.toLowerCase().replace("_", " ")}
              </Pill>
              <span className="text-sm font-extrabold tabular-nums">
                {formatMoney(order.totalMinor)}
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {order.items.map((item) => {
              const openRefund = item.refunds.find((r) =>
                ["REQUESTED", "APPROVED", "PROCESSING"].includes(r.status),
              );
              const processedRefund = item.refunds.find((r) => r.status === "PROCESSED");
              const projectInstance = item.projectInstances[0];
              const refundableNow =
                order.status !== "REFUNDED" &&
                item.fulfillmentStatus === "FULFILLED" &&
                !openRefund &&
                (item.itemType === "PROJECT"
                  ? projectInstance?.status === "PENDING_KICKOFF" &&
                    !projectInstance?.mentorKickoffAt
                  : Boolean(item.refundableUntil && item.refundableUntil > now));

              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm"
                >
                  <div>
                    <div className="font-bold">{item.titleSnapshot}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.itemType === "PROJECT"
                        ? "Refundable until mentor kickoff"
                        : item.refundableUntil
                          ? `Refundable until ${item.refundableUntil.toLocaleDateString("en-IN", { dateStyle: "medium" })}`
                          : "Non-refundable"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums">{formatMoney(item.totalMinor)}</span>
                    {processedRefund && <Pill tone="success">refunded</Pill>}
                    {openRefund && (
                      <Pill tone={REFUND_STATUS_TONE[openRefund.status] ?? "distinction"}>
                        refund {openRefund.status.toLowerCase()}
                      </Pill>
                    )}
                    {refundableNow && <RequestRefundButton orderItemId={item.id} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
