"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { createPlatformCoupon } from "@/actions/ops";
import { CouponForm } from "@/components/ops/coupon-form";

export function AdminCouponCreate() {
  const { execute, isPending } = useAction(createPlatformCoupon, {
    onSuccess: () => toast.success("Coupon created"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  return <CouponForm onSubmit={(v) => execute(v)} isPending={isPending} />;
}
