"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { grantPeriodCredits } from "@/lib/commerce/subscriptions";
import {
  cancelRazorpaySubscription,
  createRazorpaySubscription,
  ensureRazorpayPlan,
  razorpayProvider,
  verifyRazorpaySubscriptionSignature,
} from "@/lib/payments/razorpay";
import { ActionError, authActionClient } from "@/lib/safe-action";

/**
 * Starts a Razorpay Subscriptions mandate for a learner tier. Razorpay plan
 * ids are auto-provisioned on first use and persisted in plan.providerRefs.
 */
export const subscribeToPlan = authActionClient
  .inputSchema(
    z.object({
      planCode: z.string().min(1),
      interval: z.enum(["MONTHLY", "ANNUAL"]),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    if (!razorpayProvider.isConfigured()) {
      throw new ActionError("Payments aren't configured yet (set Razorpay test keys).");
    }
    const plan = await db.subscriptionPlan.findUnique({
      where: { code: parsedInput.planCode },
    });
    if (!plan || !plan.active || plan.audience !== "LEARNER") {
      throw new ActionError("Plan not found.");
    }
    if (plan.code === "FREE") throw new ActionError("The Free tier needs no subscription.");

    if (plan.code === "CAREER") {
      const flag = await db.featureFlag.findUnique({ where: { key: "career-tier" } });
      if (flag && !flag.enabled) {
        throw new ActionError("The Career tier isn't open yet — join the waitlist.");
      }
    }

    const existing = await db.subscription.findFirst({
      where: {
        userId: ctx.session.user.id,
        status: { in: ["ACTIVE", "TRIALING", "PAST_DUE", "PAUSED"] },
      },
    });
    if (existing) {
      throw new ActionError(
        "You already have an active membership — manage it from Billing.",
      );
    }

    const price = await db.price.findFirst({
      where: {
        planId: plan.id,
        currency: "INR",
        region: null,
        interval: parsedInput.interval,
        active: true,
      },
    });
    if (!price) throw new ActionError("No price configured for that interval.");

    // Auto-provision the Razorpay plan id once, then reuse.
    const refs = (plan.providerRefs ?? {}) as Record<string, string>;
    const refKey = `razorpay:${parsedInput.interval}:INR`;
    let razorpayPlanId = refs[refKey];
    if (!razorpayPlanId) {
      razorpayPlanId = await ensureRazorpayPlan({
        name: `${plan.name} (${parsedInput.interval.toLowerCase()})`,
        amountMinor: price.amountMinor,
        currency: "INR",
        interval: parsedInput.interval,
      });
      await db.subscriptionPlan.update({
        where: { id: plan.id },
        data: { providerRefs: { ...refs, [refKey]: razorpayPlanId } },
      });
    }

    const created = await createRazorpaySubscription({
      razorpayPlanId,
      interval: parsedInput.interval,
      notes: { userId: ctx.session.user.id, planCode: plan.code },
    });

    const subscription = await db.subscription.create({
      data: {
        userId: ctx.session.user.id,
        planId: plan.id,
        provider: "RAZORPAY",
        providerSubRef: created.providerSubRef,
        status: "INCOMPLETE",
        interval: parsedInput.interval,
      },
    });

    return { subscriptionId: subscription.id, checkout: created.clientPayload };
  });

/** Browser callback after the mandate is authorized — fast path before webhook. */
export const confirmSubscription = authActionClient
  .inputSchema(
    z.object({
      subscriptionId: z.string().min(1),
      providerPaymentRef: z.string().min(1),
      providerSubRef: z.string().min(1),
      signature: z.string().min(1),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const valid = verifyRazorpaySubscriptionSignature({
      providerPaymentRef: parsedInput.providerPaymentRef,
      providerSubRef: parsedInput.providerSubRef,
      signature: parsedInput.signature,
    });
    if (!valid) throw new ActionError("Subscription verification failed.");

    const sub = await db.subscription.findUnique({
      where: { id: parsedInput.subscriptionId },
    });
    if (!sub || sub.userId !== ctx.session.user.id) {
      throw new ActionError("Subscription not found.");
    }

    const periodEnd = new Date();
    if (sub.interval === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
    else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    await db.subscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      },
    });
    await grantPeriodCredits(sub.id);

    revalidatePath("/billing");
    revalidatePath("/pricing");
    return { ok: true };
  });

export const cancelMySubscription = authActionClient
  .inputSchema(z.object({ subscriptionId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const sub = await db.subscription.findUnique({
      where: { id: parsedInput.subscriptionId },
    });
    if (!sub || sub.userId !== ctx.session.user.id) {
      throw new ActionError("Subscription not found.");
    }
    if (sub.provider === "RAZORPAY" && sub.providerSubRef) {
      await cancelRazorpaySubscription(sub.providerSubRef, true);
    }
    await db.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: true, cancelledAt: new Date() },
    });
    revalidatePath("/billing");
    return { ok: true };
  });
