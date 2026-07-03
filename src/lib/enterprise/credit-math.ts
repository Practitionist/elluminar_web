import { applyBps, minusBps, taxFromInclusive } from "@/lib/money";

/**
 * Credit-pool money math — mirrors retail checkout economics exactly so a
 * pool redemption pays the creator the same paisa amounts as an equivalent
 * à la carte sale (src/actions/checkout.ts):
 *   pool deduction  = gross catalog price (tax-inclusive)
 *   taxable         = gross net of GST (taxFromInclusive)
 *   platform fee    = commissionBps of taxable
 *   seller earnings = taxable − platform fee
 */
export function computeConsumptionEconomics(input: {
  grossMinor: bigint;
  gstRateBps: number;
  commissionBps: number;
}) {
  const { taxableMinor, taxMinor } = taxFromInclusive(input.grossMinor, input.gstRateBps);
  const platformFeeMinor = applyBps(taxableMinor, input.commissionBps);
  const sellerEarningsMinor = minusBps(taxableMinor, input.commissionBps);
  return { taxableMinor, taxMinor, platformFeeMinor, sellerEarningsMinor };
}

/** Remaining pool balance; never below zero for display purposes. */
export function poolBalanceMinor(contractValueMinor: bigint, consumedMinor: bigint): bigint {
  const balance = contractValueMinor - consumedMinor;
  return balance > 0n ? balance : 0n;
}

/** A redemption is affordable only if it fits entirely in the remaining pool. */
export function canAfford(
  contractValueMinor: bigint,
  consumedMinor: bigint,
  grossMinor: bigint,
): boolean {
  return contractValueMinor - consumedMinor >= grossMinor;
}
