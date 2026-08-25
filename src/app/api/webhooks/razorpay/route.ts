import { createHash } from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/commerce/fulfillment";
import { getPaymentProvider } from "@/lib/payments";

/**
 * Razorpay webhook — the source of truth for payment state.
 * Signature-verified, idempotent via WebhookEvent (x-razorpay-event-id;
 * body-hash fallback so redeliveries without the header still dedupe).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const eventRef =
    request.headers.get("x-razorpay-event-id") ??
    `body:${createHash("sha256").update(rawBody).digest("hex")}`;

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
      refund?: {
        entity?: {
          id?: string;
          payment_id?: string;
          status?: string;
          notes?: Record<string, string>;
        };
      };
      subscription?: { entity?: { id?: string; status?: string } };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const eventType = payload.event ?? "unknown";

  const existing = await db.webhookEvent.findUnique({
    where: { provider_eventRef: { provider: "RAZORPAY", eventRef } },
  });
  if (existing?.status === "PROCESSED") {
    return NextResponse.json({ ok: true, deduped: true });
  }
  const event = await db.webhookEvent.upsert({
    where: {
      provider_eventRef: { provider: "RAZORPAY", eventRef },
    },
    update: { attempts: { increment: 1 }, status: "PROCESSING" },
    create: {
      provider: "RAZORPAY",
      eventRef,
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
    } else if (eventType === "refund.processed" || eventType === "refund.failed") {
      // Admin approval calls provider.refund() and optimistically marks the row
      // PROCESSED; this confirms provider-side settlement (or failure) and
      // settles rows left in PROCESSING by a crash between the API call and
      // the commit. Dashboard-initiated refunds with no matching row are kept
      // on the WebhookEvent and flagged for manual reconciliation.
      const entity = payload.payload?.refund?.entity;
      if (entity?.id) {
        // Match by providerRefundRef, falling back to the refundId we pass in
        // notes (covers a crash before providerRefundRef was persisted).
        const refundId = entity.notes?.refundId;
        const refund = await db.refund.findFirst({
          where: {
            OR: [
              { providerRefundRef: entity.id },
              ...(refundId ? [{ id: refundId }] : []),
            ],
          },
        });
        if (!refund) {
          Sentry.captureMessage("razorpay refund event with no matching Refund row", {
            level: "warning",
            tags: { webhook: "razorpay", eventType },
            extra: { providerRefundRef: entity.id, paymentId: entity.payment_id },
          });
        } else if (eventType === "refund.failed") {
          // Settlement failed after the approval flow already revoked access and
          // flipped fulfillment to refunded — restore user-facing state in the
          // same transaction that marks the refund FAILED. Ledger clawbacks and
          // the credit note are deliberately NOT auto-reversed (money-path
          // policy needs a designed reversal flow) — the Sentry error below
          // flags them for manual reconciliation.
          const item = refund.orderItemId
            ? await db.orderItem.findUnique({
                where: { id: refund.orderItemId },
                select: { id: true, orderId: true },
              })
            : null;
          await db.$transaction(async (tx) => {
            await tx.refund.update({
              where: { id: refund.id },
              data: { status: "FAILED", providerRefundRef: entity.id },
            });
            if (!item) return;
            await tx.orderItem.updateMany({
              where: { id: item.id, fulfillmentStatus: "REFUNDED" },
              data: { fulfillmentStatus: "FULFILLED" },
            });
            await tx.enrollment.updateMany({
              where: { orderItemId: item.id, status: "REVOKED" },
              data: { status: "ACTIVE" },
            });
            await tx.projectInstance.updateMany({
              where: { orderItemId: item.id, status: "REFUNDED" },
              data: { status: "PENDING_KICKOFF" },
            });
            const [remaining, total] = await Promise.all([
              tx.orderItem.count({
                where: { orderId: item.orderId, fulfillmentStatus: "REFUNDED" },
              }),
              tx.orderItem.count({ where: { orderId: item.orderId } }),
            ]);
            await tx.order.update({
              where: { id: item.orderId },
              data: {
                status:
                  remaining === 0 ? "PAID" : remaining === total ? "PARTIALLY_REFUNDED" : "REFUNDED",
              },
            });
          });
          Sentry.captureMessage(
            "razorpay refund failed — fulfillment restored, ledger clawback + credit note need manual reconciliation",
            {
              level: "error",
              tags: { webhook: "razorpay", eventType },
              extra: { refundId: refund.id, orderItemId: refund.orderItemId, providerRefundRef: entity.id },
            },
          );
        } else if (refund.status !== "PROCESSED" || !refund.processedAt) {
          await db.refund.update({
            where: { id: refund.id },
            data: {
              status: "PROCESSED",
              providerRefundRef: entity.id,
              processedAt: new Date(),
            },
          });
        }
      }
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
