import { describe, expect, it } from "vitest";

import { applyBps, formatMoney, minusBps, taxFromInclusive } from "@/lib/money";

describe("applyBps", () => {
  it("computes 20% of ₹19,999.00", () => {
    expect(applyBps(1999900n, 2000)).toBe(399980n);
  });
  it("rounds half-up deterministically", () => {
    // 1 paise × 50% = 0.5 → rounds to 1
    expect(applyBps(1n, 5000)).toBe(1n);
    // 3 paise × 33.33% = 0.9999 → 1
    expect(applyBps(3n, 3333)).toBe(1n);
  });
  it("handles 0 bps", () => {
    expect(applyBps(123456n, 0)).toBe(0n);
  });
});

describe("minusBps", () => {
  it("splits without losing a paisa", () => {
    const gross = 1999900n;
    const fee = applyBps(gross, 2000);
    expect(minusBps(gross, 2000) + fee).toBe(gross);
  });
});

describe("taxFromInclusive", () => {
  it("extracts 18% GST from an inclusive price", () => {
    const { taxableMinor, taxMinor } = taxFromInclusive(118000n, 1800);
    expect(taxableMinor).toBe(100000n);
    expect(taxMinor).toBe(18000n);
  });
  it("never loses paise (taxable + tax = gross)", () => {
    for (const gross of [1n, 99n, 4999_00n, 19999_00n, 123457n]) {
      const { taxableMinor, taxMinor } = taxFromInclusive(gross, 1800);
      expect(taxableMinor + taxMinor).toBe(gross);
    }
  });
  it("handles 0% rate", () => {
    const { taxableMinor, taxMinor } = taxFromInclusive(5000n, 0);
    expect(taxableMinor).toBe(5000n);
    expect(taxMinor).toBe(0n);
  });
});

describe("formatMoney", () => {
  it("formats INR without decimals for whole rupees", () => {
    expect(formatMoney(499900n, "INR")).toMatch(/₹\s?4,999/);
  });
});
