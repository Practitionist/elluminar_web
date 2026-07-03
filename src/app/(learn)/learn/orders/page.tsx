import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

import { RequestRefundButton } from "./request-refund-button";

export const metadata = { title: "Orders & refunds" };

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
      <div className="py-16 text-center text-muted-foreground">
        No orders yet — your purchases will appear here.
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Orders & refunds</h1>
      {orders.map((order) => (
        <Card key={order.id}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Order #{order.orderNo}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {order.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </span>
            </CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant={order.status === "PAID" ? "default" : "secondary"}>
                {order.status.toLowerCase().replace("_", " ")}
              </Badge>
              <span className="font-medium">{formatMoney(order.totalMinor)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
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
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{item.titleSnapshot}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.itemType === "PROJECT"
                        ? "Refundable until mentor kickoff"
                        : item.refundableUntil
                          ? `Refundable until ${item.refundableUntil.toLocaleDateString("en-IN", { dateStyle: "medium" })}`
                          : "Non-refundable"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{formatMoney(item.totalMinor)}</span>
                    {processedRefund && <Badge variant="secondary">refunded</Badge>}
                    {openRefund && <Badge variant="outline">refund {openRefund.status.toLowerCase()}</Badge>}
                    {refundableNow && <RequestRefundButton orderItemId={item.id} />}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
