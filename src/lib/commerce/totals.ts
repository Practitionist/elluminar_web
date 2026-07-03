import { applyBps, taxFromInclusive } from "@/lib/money";
import type { LearnerEntitlements } from "@/lib/validation/entitlements";

/**
 * Pure cart math — deterministic and unit-tested. All amounts are
 * tax-INCLUSIVE BigInt minor units; GST is extracted, never added on top.
 *
 * Discount precedence per line:
 *   1. entitlement discount (capstoneDiscountBps for CAPSTONE projects,
 *      else alaCarteDiscountBps) — the larger applies, they never stack
 *   2. coupon (percent or fixed, over the entitlement-discounted amount)
 */

export type PricedLineInput = {
  cartItemId: string;
  itemType: "COURSE" | "COHORT_SEAT" | "PROJECT" | "PLAN";
  projectTier?: "SPRINT" | "CAPSTONE" | "FLAGSHIP";
  unitAmountMinor: bigint;
};

export type CouponInput = {
  discountType: "PERCENT" | "FIXED_AMOUNT";
  percentBps?: number | null;
  amountMinor?: bigint | null;
  /** empty = applies to everything */
  itemTypes?: string[];
  minSubtotalMinor?: bigint | null;
};

export type PricedLine = PricedLineInput & {
  entitlementDiscountMinor: bigint;
  couponDiscountMinor: bigint;
  discountMinor: bigint;
  netMinor: bigint;
  taxMinor: bigint;
  taxableMinor: bigint;
};

export function computeCartTotals(input: {
  lines: PricedLineInput[];
  entitlements?: LearnerEntitlements | null;
  coupon?: CouponInput | null;
  gstRateBps: number;
}) {
  const ent = input.entitlements;

  // Pass 1: entitlement discounts per line.
  const withEntitlement = input.lines.map((line) => {
    let bps = 0;
    if (ent) {
      bps = ent.alaCarteDiscountBps;
      if (line.itemType === "PROJECT" && line.projectTier === "CAPSTONE") {
        bps = Math.max(bps, ent.capstoneDiscountBps);
      }
    }
    const entitlementDiscountMinor = applyBps(line.unitAmountMinor, bps);
    return { ...line, entitlementDiscountMinor };
  });

  // Pass 2: coupon over entitlement-discounted amounts.
  const eligible = (line: PricedLineInput) =>
    !input.coupon?.itemTypes?.length || input.coupon.itemTypes.includes(line.itemType);

  const couponBase = withEntitlement
    .filter(eligible)
    .reduce((sum, l) => sum + (l.unitAmountMinor - l.entitlementDiscountMinor), 0n);

  let couponTotal = 0n;
  const coupon = input.coupon;
  if (coupon && couponBase > 0n) {
    if (coupon.minSubtotalMinor != null && couponBase < coupon.minSubtotalMinor) {
      couponTotal = 0n;
    } else if (coupon.discountType === "PERCENT") {
      couponTotal = applyBps(couponBase, coupon.percentBps ?? 0);
    } else {
      couponTotal = coupon.amountMinor ?? 0n;
      if (couponTotal > couponBase) couponTotal = couponBase;
    }
  }

  // Distribute the coupon proportionally across eligible lines (largest-remainder safe:
  // last eligible line absorbs the rounding residue so the sum is exact).
  const eligibleLines = withEntitlement.filter(eligible);
  let distributed = 0n;
  const lines: PricedLine[] = withEntitlement.map((line) => {
    let couponDiscountMinor = 0n;
    if (couponTotal > 0n && eligible(line) && couponBase > 0n) {
      const base = line.unitAmountMinor - line.entitlementDiscountMinor;
      const isLastEligible = eligibleLines[eligibleLines.length - 1]?.cartItemId === line.cartItemId;
      couponDiscountMinor = isLastEligible
        ? couponTotal - distributed
        : (couponTotal * base) / couponBase;
      distributed += couponDiscountMinor;
    }
    const discountMinor = line.entitlementDiscountMinor + couponDiscountMinor;
    const netMinor = line.unitAmountMinor - discountMinor;
    const { taxableMinor, taxMinor } = taxFromInclusive(netMinor, input.gstRateBps);
    return { ...line, couponDiscountMinor, discountMinor, netMinor, taxMinor, taxableMinor };
  });

  const subtotalMinor = lines.reduce((s, l) => s + l.unitAmountMinor, 0n);
  const discountMinor = lines.reduce((s, l) => s + l.discountMinor, 0n);
  const taxMinor = lines.reduce((s, l) => s + l.taxMinor, 0n);
  const totalMinor = subtotalMinor - discountMinor;

  return { lines, subtotalMinor, discountMinor, taxMinor, totalMinor };
}
