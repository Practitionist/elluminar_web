import "server-only";

import type { PaymentProvider } from "@/lib/payments/provider";
import { razorpayProvider } from "@/lib/payments/razorpay";

/**
 * Active provider selection. Dodo Payments (post-MVP, issue #1) will slot in
 * here behind the same interface — likely keyed by currency/region (Razorpay
 * for INR domestic, Dodo as merchant of record internationally).
 */
export function getPaymentProvider(): PaymentProvider {
  return razorpayProvider;
}

export type { PaymentProvider } from "@/lib/payments/provider";
