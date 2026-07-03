"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { createTenantCoupon } from "@/actions/ops";
import { CouponForm } from "@/components/ops/coupon-form";

export function TenantCouponCreate({ tenantSlug }: { tenantSlug: string }) {
  const { execute, isPending } = useAction(createTenantCoupon, {
    onSuccess: () => toast.success("Coupon created"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  return <CouponForm onSubmit={(v) => execute({ tenantSlug, ...v })} isPending={isPending} />;
}
