import { Pill } from "@/components/shared";
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
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        Refund requests
      </h1>
      {refunds.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending refund requests.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                  Item
                </TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                  Buyer
                </TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                  Reason
                </TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                  Amount
                </TableHead>
                <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">
                  Decision
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refunds.map((r) => (
                <TableRow key={r.id} className="border-t border-border">
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
                    <Pill tone="neutral">{r.reason.toLowerCase().replace("_", " ")}</Pill>
                  </TableCell>
                  <TableCell className="font-medium">{formatMoney(r.amountMinor)}</TableCell>
                  <TableCell className="text-right">
                    <RefundDecisionButtons refundId={r.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
