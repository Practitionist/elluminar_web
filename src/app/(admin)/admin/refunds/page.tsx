import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

import { RefundDecisionButtons } from "./refund-decision-buttons";

export const metadata = { title: "Refund requests" };

export default async function AdminRefundsPage() {
  const refunds = await db.refund.findMany({
    where: { status: "REQUESTED" },
    orderBy: { createdAt: "asc" },
    include: {
      orderItem: { include: { order: { include: { user: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Refund requests</h1>
      {refunds.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending refund requests.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {refunds.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.orderItem?.titleSnapshot}</div>
                  <div className="text-xs text-muted-foreground">
                    Order #{r.orderItem?.order.orderNo} ·{" "}
                    {r.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </div>
                  {r.note && <p className="mt-1 text-xs text-muted-foreground">“{r.note}”</p>}
                </TableCell>
                <TableCell>
                  <div>{r.orderItem?.order.user.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.orderItem?.order.user.email}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{r.reason.toLowerCase().replace("_", " ")}</Badge>
                </TableCell>
                <TableCell className="font-medium">{formatMoney(r.amountMinor)}</TableCell>
                <TableCell className="text-right">
                  <RefundDecisionButtons refundId={r.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
