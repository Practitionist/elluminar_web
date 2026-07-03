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

export const metadata = { title: "Orders" };

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
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id}>
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
                <Badge
                  variant={
                    o.status === "PAID"
                      ? "default"
                      : o.status === "PENDING_PAYMENT"
                        ? "outline"
                        : "secondary"
                  }
                >
                  {o.status.toLowerCase().replace(/_/g, " ")}
                </Badge>
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
  );
}
