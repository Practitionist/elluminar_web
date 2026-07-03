import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";

import { AdminCouponCreate } from "./admin-coupon-create";

export const metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  const coupons = await db.coupon.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      tenant: { select: { displayName: true } },
      _count: { select: { redemptions: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Coupons</h1>
      <AdminCouponCreate />
      <div className="space-y-2">
        {coupons.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <div>
              <span className="font-mono font-medium">{c.code}</span>
              <span className="text-muted-foreground"> · {c.name}</span>
              {c.tenant && (
                <span className="text-xs text-muted-foreground"> · {c.tenant.displayName}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span>
                {c.discountType === "PERCENT"
                  ? `${(c.percentBps ?? 0) / 100}% off`
                  : `₹${Number(c.amountMinor ?? 0n) / 100} off`}
              </span>
              <Badge variant="outline">
                {c._count.redemptions}
                {c.maxRedemptions ? `/${c.maxRedemptions}` : ""} used
              </Badge>
              <Badge variant={c.active ? "default" : "secondary"}>
                {c.active ? "active" : "off"}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
