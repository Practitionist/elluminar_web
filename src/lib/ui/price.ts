/**
 * Price resolution for catalog cards.
 *
 * No entity stores price inline — `Course`/`Project`/`SubscriptionPlan` expose
 * `prices Price[]` where money is `amountMinor` (BigInt paise) + optional
 * `compareAtMinor`. These helpers run on the SERVER (they touch BigInt) and
 * produce a plain, serializable `PriceDisplay` so client card components never
 * receive a BigInt. Always format via `formatMoney`.
 */

import { formatMoney } from "@/lib/money";

export type PriceLike = {
  amountMinor: bigint;
  compareAtMinor?: bigint | null;
  currency?: string | null;
  mentorLevel?: string | null;
};

/** Pick the active price: prefer a matching mentor level, else the cheapest. */
export function resolveActivePrice<T extends PriceLike>(
  prices: T[] | null | undefined,
  opts?: { mentorLevel?: string },
): T | null {
  if (!prices || prices.length === 0) return null;
  if (opts?.mentorLevel) {
    const match = prices.find((p) => p.mentorLevel === opts.mentorLevel);
    if (match) return match;
  }
  return [...prices].sort((a, b) =>
    a.amountMinor < b.amountMinor ? -1 : a.amountMinor > b.amountMinor ? 1 : 0,
  )[0];
}

export type PriceDisplay = {
  /** Formatted active price, or "Free". */
  label: string;
  /** Struck-through compare-at price, when higher than the active price. */
  compareLabel?: string;
  isFree: boolean;
};

export function priceDisplay(price: PriceLike | null): PriceDisplay {
  if (!price || price.amountMinor <= 0n) {
    return { label: "Free", isFree: true };
  }
  const currency = price.currency ?? "INR";
  const compareLabel =
    price.compareAtMinor && price.compareAtMinor > price.amountMinor
      ? formatMoney(price.compareAtMinor, currency)
      : undefined;
  return {
    label: formatMoney(price.amountMinor, currency),
    compareLabel,
    isFree: false,
  };
}

/** Convenience: resolve + format in one call from a `prices` relation. */
export function displayFromPrices(
  prices: PriceLike[] | null | undefined,
  opts?: { mentorLevel?: string },
): PriceDisplay {
  return priceDisplay(resolveActivePrice(prices, opts));
}
