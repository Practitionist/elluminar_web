import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/commerce/fulfillment";
import { getPaymentProvider } from "@/lib/payments";

/**
 * Razorpay webhook — the source of truth for payment state.
 * Signature-verified, idempotent via WebhookEvent (x-razorpay-event-id).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const eventRef = request.headers.get("x-razorpay-event-id") ?? undefined;

  const provider = getPaymentProvider();
  const signatureValid = provider.verifyWebhookSignature(rawBody, signature);
  if (!signatureValid) {
    Sentry.captureMessage("razorpay webhook signature verification failed", {
      level: "warning",
      tags: { webhook: "razorpay" },
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; method?: string; notes?: Record<string, string> } };
      subscription?: { entity?: { id?: string; status?: string } };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const eventType = payload.event ?? "unknown";

  if (eventRef) {
    const existing = await db.webhookEvent.findUnique({
      where: { provider_eventRef: { provider: "RAZORPAY", eventRef } },
    });
    if (existing?.status === "PROCESSED") {
      return NextResponse.json({ ok: true, deduped: true });
    }
  }
  const event = await db.webhookEvent.upsert({
    where: {
      provider_eventRef: {
        provider: "RAZORPAY",
        eventRef: eventRef ?? `no-ref:${crypto.randomUUID()}`,
      },
    },
    update: { attempts: { increment: 1 }, status: "PROCESSING" },
    create: {
      provider: "RAZORPAY",
      eventRef: eventRef ?? `no-ref:${crypto.randomUUID()}`,
      eventType,
      signatureValid,
      payload: payload as object,
      status: "PROCESSING",
    },
  });

  try {
    if (eventType === "payment.captured") {
      const entity = payload.payload?.payment?.entity;
      const orderId = entity?.notes?.orderId;
      if (entity?.id && orderId) {
        await fulfillPaidOrder({
          orderId,
          provider: "RAZORPAY",
          providerPaymentRef: entity.id,
          method: entity.method,
          raw: entity,
        });
      }
    } else if (eventType === "payment.failed") {
      const entity = payload.payload?.payment?.entity;
      const orderId = entity?.notes?.orderId;
      if (orderId) {
        await db.order.updateMany({
          where: { id: orderId, status: "PENDING_PAYMENT" },
          data: { status: "FAILED" },
        });
      }
    } else if (eventType === "refund.processed") {
      const entity = payload.payload?.payment?.entity as
        | { id?: string; refund_id?: string }
        | undefined;
      // Refund reconciliation is handled in the refunds module (M7); the event
      // is stored for the reconciliation sweep even when unmatched here.
      void entity;
    } else if (eventType.startsWith("subscription.")) {
      // Subscription lifecycle handled by the subscriptions module (M8).
      const { handleRazorpaySubscriptionEvent } = await import(
        "@/lib/commerce/subscriptions"
      );
      await handleRazorpaySubscriptionEvent(eventType, payload as never);
    }

    await db.webhookEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { webhook: "razorpay", eventType } });
    await db.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    // Return 500 so Razorpay retries.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
