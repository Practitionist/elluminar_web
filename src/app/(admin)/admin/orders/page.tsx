import { Pill, type PillTone } from "@/components/shared";
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

export const metadata = { title: "Orders" };

const ORDER_STATUS_TONE: Record<string, PillTone> = {
  DRAFT: "neutral",
  PENDING_PAYMENT: "distinction",
  PAID: "success",
  PARTIALLY_REFUNDED: "destructive",
  REFUNDED: "destructive",
  FAILED: "destructive",
  CANCELLED: "destructive",
  EXPIRED: "neutral",
};

export default async function AdminOrdersPage() {
  const orders = await db.order.findMany({
    where: { status: { not: "DRAFT" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, email: true } },
      items: { select: { titleSnapshot: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        Orders
      </h1>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                #
              </TableHead>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                Buyer
              </TableHead>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                Items
              </TableHead>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                Total
              </TableHead>
              <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                Date
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id} className="border-t border-border">
                <TableCell className="font-medium">#{o.orderNo}</TableCell>
                <TableCell>
                  <div>{o.user.name}</div>
                  <div className="text-xs text-muted-foreground">{o.user.email}</div>
                </TableCell>
                <TableCell className="max-w-xs">
                  <p className="line-clamp-2 text-sm">
                    {o.items.map((i) => i.titleSnapshot).join(", ")}
                  </p>
                </TableCell>
                <TableCell>
                  <Pill tone={ORDER_STATUS_TONE[o.status] ?? "neutral"}>
                    {o.status.toLowerCase().replace(/_/g, " ")}
                  </Pill>
                </TableCell>
                <TableCell className="font-medium">{formatMoney(o.totalMinor)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {o.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
