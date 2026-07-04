import { Pill } from "@/components/shared";
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
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        Coupons
      </h1>
      <AdminCouponCreate />
      <div className="space-y-2">
        {coupons.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm"
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
              <Pill tone="neutral">
                {c._count.redemptions}
                {c.maxRedemptions ? `/${c.maxRedemptions}` : ""} used
              </Pill>
              <Pill tone={c.active ? "success" : "neutral"}>
                {c.active ? "active" : "off"}
              </Pill>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
