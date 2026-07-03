import { Badge } from "@/components/ui/badge";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { TenantCouponCreate } from "./tenant-coupon-create";

export const metadata = { title: "Coupons" };

export default async function StudioCouponsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin"]);

  const coupons = await db.coupon.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coupons</h1>
        <p className="text-sm text-muted-foreground">
          Apply to your catalog only. Quantified discounts convert better than
          vague ones — “₹500 off” beats “special offer”.
        </p>
      </div>
      <TenantCouponCreate tenantSlug={tenantSlug} />
      <div className="space-y-2">
        {coupons.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <div>
              <span className="font-mono font-medium">{c.code}</span>
              <span className="text-muted-foreground"> · {c.name}</span>
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
