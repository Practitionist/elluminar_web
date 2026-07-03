import "server-only";

import { db } from "@/lib/db";
import { writeLedgerEntry } from "@/lib/commerce/fulfillment";

/**
 * Subscription lifecycle (Razorpay Subscriptions). Our Subscription row is the
 * entitlement source of truth; Razorpay events reconcile it.
 *
 * Load-bearing rule: when a subscription lapses, exactly the enrollments with
 * Enrollment.subscriptionId = sub.id are expired (nothing purchased à la carte
 * is ever touched).
 */

type RazorpaySubscriptionEntity = {
  id?: string;
  status?: string;
  current_start?: number;
  current_end?: number;
  paid_count?: number;
};

type RazorpayWebhookPayload = {
  payload?: {
    subscription?: { entity?: RazorpaySubscriptionEntity };
    payment?: { entity?: { id?: string; method?: string; amount?: number } };
  };
};

const STATUS_MAP: Record<string, "ACTIVE" | "PAST_DUE" | "PAUSED" | "CANCELLED" | "EXPIRED"> = {
  active: "ACTIVE",
  halted: "PAST_DUE",
  paused: "PAUSED",
  cancelled: "CANCELLED",
  completed: "EXPIRED",
  expired: "EXPIRED",
};

export async function handleRazorpaySubscriptionEvent(
  eventType: string,
  payload: RazorpayWebhookPayload,
) {
  const entity = payload.payload?.subscription?.entity;
  if (!entity?.id) return;

  const sub = await db.subscription.findFirst({
    where: { provider: "RAZORPAY", providerSubRef: entity.id },
  });
  if (!sub) return;

  const period = {
    currentPeriodStart: entity.current_start
      ? new Date(entity.current_start * 1000)
      : undefined,
    currentPeriodEnd: entity.current_end ? new Date(entity.current_end * 1000) : undefined,
  };

  if (eventType === "subscription.charged") {
    const paymentEntity = payload.payload?.payment?.entity;
    await db.subscription.update({
      where: { id: sub.id },
      data: { status: "ACTIVE", ...period },
    });
    if (paymentEntity?.id) {
      await db.$transaction(async (tx) => {
        const existing = await tx.payment.findFirst({
          where: { provider: "RAZORPAY", providerPaymentRef: paymentEntity.id },
        });
        if (existing) return;
        await tx.payment.create({
          data: {
            subscriptionId: sub.id,
            provider: "RAZORPAY",
            providerPaymentRef: paymentEntity.id,
            method: paymentEntity.method,
            amountMinor: BigInt(paymentEntity.amount ?? 0),
            currency: "INR",
            status: "CAPTURED",
            capturedAt: new Date(),
            raw: paymentEntity as object,
          },
        });
        await writeLedgerEntry(tx, {
          account: { ownerType: "PLATFORM" },
          entryType: "SUBSCRIPTION_EARNING",
          amountMinor: BigInt(paymentEntity.amount ?? 0),
          subscriptionId: sub.id,
          memo: "Subscription renewal",
          idempotencyKey: `subcharge:${paymentEntity.id}`,
        });
      });
    }
    await grantPeriodCredits(sub.id);
    return;
  }

  const mapped = STATUS_MAP[entity.status ?? ""];
  if (!mapped && eventType === "subscription.activated") {
    await db.subscription.update({
      where: { id: sub.id },
      data: { status: "ACTIVE", ...period },
    });
    await grantPeriodCredits(sub.id);
    return;
  }
  if (!mapped) return;

  await db.subscription.update({
    where: { id: sub.id },
    data: {
      status: mapped,
      ...period,
      cancelledAt: mapped === "CANCELLED" ? new Date() : undefined,
      endedAt: mapped === "EXPIRED" || mapped === "CANCELLED" ? new Date() : undefined,
      pausedAt: mapped === "PAUSED" ? new Date() : undefined,
    },
  });

  if (mapped === "CANCELLED" || mapped === "EXPIRED" || mapped === "PAST_DUE") {
    // PAST_DUE keeps access until period end; hard lapse expires it.
    if (mapped !== "PAST_DUE") {
      await db.enrollment.updateMany({
        where: { subscriptionId: sub.id, status: "ACTIVE" },
        data: { status: "EXPIRED", expiresAt: new Date() },
      });
    }
    await db.notification.create({
      data: {
        userId: sub.userId ?? "",
        category: "billing",
        title:
          mapped === "PAST_DUE"
            ? "Payment failed — we'll retry"
            : "Your subscription has ended",
        body:
          mapped === "PAST_DUE"
            ? "Update your payment method to keep your membership benefits."
            : "Library access from your membership is paused. Your purchases are untouched.",
        actionUrl: "/billing",
      },
    }).catch(() => undefined);
  }
}

/** Grants per-period project credits from the plan's entitlements. */
export async function grantPeriodCredits(subscriptionId: string) {
  const sub = await db.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });
  if (!sub || !sub.currentPeriodStart) return;

  const ent = sub.plan.entitlements as {
    sprintCreditsPerMonth?: number;
    flagshipCreditsPerYear?: number;
  };
  const flagshipEnabled = await db.featureFlag.findUnique({
    where: { key: "career-flagship-credit" },
  });

  const monthKey = sub.currentPeriodStart.toISOString().slice(0, 7);
  const yearKey = sub.currentPeriodStart.toISOString().slice(0, 4);

  if (ent.sprintCreditsPerMonth && ent.sprintCreditsPerMonth > 0) {
    await db.subscriptionCredit.upsert({
      where: {
        subscriptionId_creditType_periodKey: {
          subscriptionId: sub.id,
          creditType: "SPRINT_PROJECT",
          periodKey: monthKey,
        },
      },
      update: { grantedCount: ent.sprintCreditsPerMonth },
      create: {
        subscriptionId: sub.id,
        creditType: "SPRINT_PROJECT",
        periodKey: monthKey,
        grantedCount: ent.sprintCreditsPerMonth,
      },
    });
  }
  if (ent.flagshipCreditsPerYear && ent.flagshipCreditsPerYear > 0 && flagshipEnabled?.enabled) {
    await db.subscriptionCredit.upsert({
      where: {
        subscriptionId_creditType_periodKey: {
          subscriptionId: sub.id,
          creditType: "FLAGSHIP_PROJECT",
          periodKey: yearKey,
        },
      },
      update: { grantedCount: ent.flagshipCreditsPerYear },
      create: {
        subscriptionId: sub.id,
        creditType: "FLAGSHIP_PROJECT",
        periodKey: yearKey,
        grantedCount: ent.flagshipCreditsPerYear,
      },
    });
  }
}
