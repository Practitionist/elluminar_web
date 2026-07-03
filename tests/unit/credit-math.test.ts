import { describe, expect, it } from "vitest";

import {
  canAfford,
  computeConsumptionEconomics,
  poolBalanceMinor,
} from "@/lib/enterprise/credit-math";

const GST = 1800;

describe("computeConsumptionEconomics", () => {
  it("reconstitutes gross to the paisa (tax + fee + earnings)", () => {
    for (const gross of [499900n, 1999900n, 123457n, 99n, 1n]) {
      const { taxableMinor, taxMinor, platformFeeMinor, sellerEarningsMinor } =
        computeConsumptionEconomics({ grossMinor: gross, gstRateBps: GST, commissionBps: 2000 });
      expect(taxableMinor + taxMinor).toBe(gross);
      expect(platformFeeMinor + sellerEarningsMinor).toBe(taxableMinor);
    }
  });

  it("matches retail checkout economics for the same price", () => {
    // ₹19,999 capstone at 20% commission — the exact numbers checkout produces.
    const e = computeConsumptionEconomics({
      grossMinor: 1999900n,
      gstRateBps: GST,
      commissionBps: 2000,
    });
    expect(e.taxableMinor).toBe(1694831n); // 1999900 × 10000/11800 rounded half-up
    expect(e.taxMinor).toBe(305069n);
    expect(e.platformFeeMinor).toBe(338966n);
    expect(e.sellerEarningsMinor).toBe(1355865n);
  });

  it("handles zero commission (platform-owned content)", () => {
    const e = computeConsumptionEconomics({
      grossMinor: 100000n,
      gstRateBps: GST,
      commissionBps: 0,
    });
    expect(e.platformFeeMinor).toBe(0n);
    expect(e.sellerEarningsMinor).toBe(e.taxableMinor);
  });
});

describe("pool balance & affordability", () => {
  it("computes remaining balance and floors at zero", () => {
    expect(poolBalanceMinor(50_000_00n, 20_000_00n)).toBe(30_000_00n);
    expect(poolBalanceMinor(50_000_00n, 60_000_00n)).toBe(0n);
  });

  it("rejects redemption at the exact over-boundary and allows exact fit", () => {
    expect(canAfford(50_000_00n, 48_000_00n, 2_000_00n)).toBe(true); // exact fit
    expect(canAfford(50_000_00n, 48_000_01n, 2_000_00n)).toBe(false); // 1 paisa short
  });
});
