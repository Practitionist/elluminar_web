import { describe, expect, it } from "vitest";

import { computeCartTotals, type PricedLineInput } from "@/lib/commerce/totals";
import { learnerEntitlementsSchema } from "@/lib/validation/entitlements";

const GST = 1800;

const course = (id: string, amount: bigint): PricedLineInput => ({
  cartItemId: id,
  itemType: "COURSE",
  unitAmountMinor: amount,
});
const capstone = (id: string, amount: bigint): PricedLineInput => ({
  cartItemId: id,
  itemType: "PROJECT",
  projectTier: "CAPSTONE",
  unitAmountMinor: amount,
});

describe("computeCartTotals", () => {
  it("charges list price with no entitlements or coupon", () => {
    const t = computeCartTotals({
      lines: [course("a", 499900n)],
      gstRateBps: GST,
    });
    expect(t.subtotalMinor).toBe(499900n);
    expect(t.discountMinor).toBe(0n);
    expect(t.totalMinor).toBe(499900n);
    // 18% GST extracted from inclusive price
    expect(t.lines[0].taxableMinor + t.lines[0].taxMinor).toBe(499900n);
  });

  it("applies the larger of capstone vs à-la-carte discount, never both", () => {
    const ent = learnerEntitlementsSchema.parse({
      alaCarteDiscountBps: 500,
      capstoneDiscountBps: 2000,
    });
    const t = computeCartTotals({
      lines: [capstone("p", 1999900n), course("c", 499900n)],
      entitlements: ent,
      gstRateBps: GST,
    });
    // capstone gets 20%, course gets 5%
    expect(t.lines[0].entitlementDiscountMinor).toBe(399980n);
    expect(t.lines[1].entitlementDiscountMinor).toBe(24995n);
    expect(t.totalMinor).toBe(t.subtotalMinor - t.discountMinor);
  });

  it("distributes a percent coupon proportionally with exact total", () => {
    const t = computeCartTotals({
      lines: [course("a", 100000n), course("b", 300000n)],
      coupon: { discountType: "PERCENT", percentBps: 1000 },
      gstRateBps: GST,
    });
    const couponTotal = t.lines.reduce((s, l) => s + l.couponDiscountMinor, 0n);
    expect(couponTotal).toBe(40000n); // 10% of 4000.00
    expect(t.totalMinor).toBe(360000n);
  });

  it("caps a fixed coupon at the eligible base and respects itemTypes", () => {
    const t = computeCartTotals({
      lines: [course("a", 50000n), capstone("p", 1999900n)],
      coupon: {
        discountType: "FIXED_AMOUNT",
        amountMinor: 100000n,
        itemTypes: ["COURSE"],
      },
      gstRateBps: GST,
    });
    // Only the ₹500 course is eligible; coupon capped at 50000.
    expect(t.lines[0].couponDiscountMinor).toBe(50000n);
    expect(t.lines[1].couponDiscountMinor).toBe(0n);
  });

  it("ignores coupons under their minimum subtotal", () => {
    const t = computeCartTotals({
      lines: [course("a", 50000n)],
      coupon: {
        discountType: "PERCENT",
        percentBps: 5000,
        minSubtotalMinor: 100000n,
      },
      gstRateBps: GST,
    });
    expect(t.discountMinor).toBe(0n);
  });

  it("keeps line-level tax + taxable equal to net (no paisa lost)", () => {
    const t = computeCartTotals({
      lines: [course("a", 123457n), capstone("p", 999999n)],
      coupon: { discountType: "PERCENT", percentBps: 1234 },
      entitlements: learnerEntitlementsSchema.parse({ alaCarteDiscountBps: 500 }),
      gstRateBps: GST,
    });
    for (const line of t.lines) {
      expect(line.taxableMinor + line.taxMinor).toBe(line.netMinor);
    }
    expect(t.totalMinor).toBe(t.lines.reduce((s, l) => s + l.netMinor, 0n));
  });
});
