import { Pill } from "@/components/shared";
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
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Coupons
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apply to your catalog only. Quantified discounts convert better than
          vague ones — “₹500 off” beats “special offer”.
        </p>
      </div>
      <TenantCouponCreate tenantSlug={tenantSlug} />
      <div className="space-y-2">
        {coupons.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <div className="text-sm">
              <span className="font-mono font-bold">{c.code}</span>
              <span className="text-muted-foreground"> · {c.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                {c.discountType === "PERCENT"
                  ? `${(c.percentBps ?? 0) / 100}% off`
                  : `₹${Number(c.amountMinor ?? 0n) / 100} off`}
              </span>
              <Pill tone="neutral">
                {c._count.redemptions}
                {c.maxRedemptions ? `/${c.maxRedemptions}` : ""} used
              </Pill>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
