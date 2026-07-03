import "server-only";

import crypto from "node:crypto";

import Razorpay from "razorpay";

import { env } from "@/env";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
  RefundInput,
} from "@/lib/payments/provider";

let client: Razorpay | null = null;
function razorpay(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay is not configured (set RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET).");
  }
  client ??= new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
  return client;
}

function hmacSha256(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const razorpayProvider: PaymentProvider = {
  kind: "RAZORPAY",

  isConfigured() {
    return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  },

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const order = await razorpay().orders.create({
      amount: Number(input.amountMinor), // Razorpay wants paise as number
      currency: input.currency,
      receipt: input.orderId,
      notes: input.notes,
    });
    return {
      providerOrderRef: order.id,
      clientPayload: {
        provider: "RAZORPAY",
        keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? env.RAZORPAY_KEY_ID,
        razorpayOrderId: order.id,
        amount: Number(input.amountMinor),
        currency: input.currency,
        prefill: {
          email: input.buyer.email,
          name: input.buyer.name ?? undefined,
          contact: input.buyer.phone ?? undefined,
        },
      },
    };
  },

  async refund(input: RefundInput) {
    const refund = await razorpay().payments.refund(input.providerPaymentRef, {
      amount: Number(input.amountMinor),
      speed: "normal",
      notes: input.notes,
    });
    return { providerRefundRef: refund.id, raw: refund };
  },

  verifyWebhookSignature(rawBody, signature) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
    return safeEqual(hmacSha256(env.RAZORPAY_WEBHOOK_SECRET, rawBody), signature);
  },

  verifyCheckoutSignature({ providerOrderRef, providerPaymentRef, signature }) {
    if (!env.RAZORPAY_KEY_SECRET) return false;
    const expected = hmacSha256(
      env.RAZORPAY_KEY_SECRET,
      `${providerOrderRef}|${providerPaymentRef}`,
    );
    return safeEqual(expected, signature);
  },
};
