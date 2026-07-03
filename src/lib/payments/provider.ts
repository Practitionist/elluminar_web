import "server-only";

/**
 * Payment provider abstraction — Razorpay at MVP, Dodo Payments post-MVP
 * (issue #1). No provider types leak past this interface; our Order/Payment/
 * Refund rows are the source of truth.
 */

export type CreateCheckoutInput = {
  orderId: string;
  amountMinor: bigint;
  currency: string;
  buyer: { email: string; name?: string | null; phone?: string | null };
  notes?: Record<string, string>;
};

export type CreateCheckoutResult = {
  providerOrderRef: string;
  /** Data the client needs to open the provider's checkout UI. */
  clientPayload: Record<string, unknown>;
};

export type RefundInput = {
  providerPaymentRef: string;
  amountMinor: bigint;
  notes?: Record<string, string>;
};

export interface PaymentProvider {
  readonly kind: "RAZORPAY" | "DODO";
  isConfigured(): boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  refund(input: RefundInput): Promise<{ providerRefundRef: string; raw: unknown }>;
  /** Verifies a webhook body signature. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  /** Verifies the browser-returned payment signature (checkout callback). */
  verifyCheckoutSignature(params: {
    providerOrderRef: string;
    providerPaymentRef: string;
    signature: string;
  }): boolean;
}
