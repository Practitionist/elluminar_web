/**
 * Money helpers. All amounts are BigInt minor units (paise/cents).
 * Safe for display formatting and bps math; never use floats for money.
 */

const CURRENCY_LOCALE: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
};

export function formatMoney(amountMinor: bigint, currency = "INR"): string {
  const locale = CURRENCY_LOCALE[currency] ?? "en-IN";
  const major = Number(amountMinor) / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: major % 1 === 0 ? 0 : 2,
  }).format(major);
}

/** Apply basis points to a minor amount, rounding half-up deterministically. */
export function applyBps(amountMinor: bigint, bps: number): bigint {
  return (amountMinor * BigInt(Math.round(bps)) + 5000n) / 10000n;
}

/** amount − bps(amount) */
export function minusBps(amountMinor: bigint, bps: number): bigint {
  return amountMinor - applyBps(amountMinor, bps);
}

/**
 * Extract the tax component from a TAX-INCLUSIVE amount at rate `rateBps`.
 * taxable = gross × 10000 / (10000 + rate); tax = gross − taxable.
 */
export function taxFromInclusive(grossMinor: bigint, rateBps: number): {
  taxableMinor: bigint;
  taxMinor: bigint;
} {
  const denominator = 10000n + BigInt(Math.round(rateBps));
  const taxableMinor = (grossMinor * 10000n + denominator / 2n) / denominator;
  return { taxableMinor, taxMinor: grossMinor - taxableMinor };
}
