"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getOrCreateActiveCart } from "@/actions/cart";
import { cohortSeatBlocker } from "@/lib/commerce/cohort-seats";
import { db } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/commerce/fulfillment";
import { resolveCartPricing } from "@/lib/commerce/pricing";
import { minusBps, applyBps } from "@/lib/money";
import { getPaymentProvider } from "@/lib/payments";
import { ActionError, authActionClient } from "@/lib/safe-action";

/**
 * Creates a pending Order (full snapshot) from the active cart and returns the
 * provider checkout payload for the browser (Razorpay modal).
 */
export const createCheckout = authActionClient
  .inputSchema(
    z.object({
      couponCode: z.string().max(40).optional(),
      billingName: z.string().max(120).optional(),
      billingPhone: z.string().max(20).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const provider = getPaymentProvider();
    if (!provider.isConfigured()) {
      throw new ActionError(
        "Payments aren't configured yet (set Razorpay test keys in .env).",
      );
    }

    const cart = await getOrCreateActiveCart();
    const pricing = await resolveCartPricing(cart.id, {
      userId: ctx.session.user.id,
      couponCode: parsedInput.couponCode,
    });
    if (pricing.lines.length === 0) throw new ActionError("Your cart is empty.");
    if (pricing.totalMinor <= 0n) throw new ActionError("Total must be greater than zero.");

    // Cohort seats are finite. Check BEFORE creating the payment order — the
    // fulfillment path runs after money has moved, so refusing there would
    // strand a paid learner. (Program seats already gate this way.)
    for (const line of pricing.lines) {
      if (line.itemType !== "COHORT_SEAT" || !line.cohortId) continue;
      const cohort = await db.cohort.findUnique({
        where: { id: line.cohortId },
        include: { _count: { select: { enrollments: true } } },
      });
      if (!cohort) throw new ActionError("That cohort is no longer available.");
      const blocked = cohortSeatBlocker({
        status: cohort.status,
        capacity: cohort.capacity,
        taken: cohort._count.enrollments,
        enrollmentClosesAt: cohort.enrollmentClosesAt,
      });
      if (blocked === "not-open") {
        throw new ActionError(`Enrolment for ${cohort.name} isn't open.`);
      }
      if (blocked === "closed") {
        throw new ActionError(`Enrolment for ${cohort.name} has closed.`);
      }
      if (blocked === "full") {
        throw new ActionError(`${cohort.name} is full (${cohort.capacity} seats).`);
      }
    }

    const user = await db.user.findUniqueOrThrow({ where: { id: ctx.session.user.id } });

    const order = await db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: user.id,
          status: "PENDING_PAYMENT",
          currency: "INR",
          subtotalMinor: pricing.subtotalMinor,
          discountMinor: pricing.discountMinor,
          taxMinor: pricing.taxMinor,
          totalMinor: pricing.totalMinor,
          couponId: pricing.coupon?.id,
          billTo: {
            name: parsedInput.billingName ?? user.name,
            email: user.email,
            phone: parsedInput.billingPhone ?? user.phone,
          },
          placedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      for (const line of pricing.lines) {
        const commissionBps = line.commissionBps ?? 0;
        // Seller economics on the taxable (net-of-GST) base.
        const platformFeeMinor = line.sellerTenantId
          ? applyBps(line.taxableMinor, commissionBps)
          : null;
        const sellerEarningsMinor = line.sellerTenantId
          ? minusBps(line.taxableMinor, commissionBps)
          : null;

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            itemType: line.itemType,
            courseId: line.courseId,
            cohortId: line.cohortId,
            projectId: line.projectId,
            sellerTenantId: line.sellerTenantId,
            titleSnapshot: line.title,
            priceId: line.priceId,
            unitAmountMinor: line.unitAmountMinor,
            quantity: 1,
            discountMinor: line.discountMinor,
            taxMinor: line.taxMinor,
            taxRateBps: pricing.gstRateBps,
            totalMinor: line.netMinor,
            commissionBpsSnapshot: line.sellerTenantId ? commissionBps : null,
            platformFeeMinor,
            sellerEarningsMinor,
            refundWindowDays: line.refundWindowDays,
            metadata: line.mentorLevel ? { mentorLevel: line.mentorLevel } : undefined,
          },
        });
      }

      if (pricing.coupon) {
        await tx.couponRedemption.create({
          data: {
            couponId: pricing.coupon.id,
            orderId: order.id,
            userId: user.id,
            discountMinor: pricing.lines.reduce((s, l) => s + l.couponDiscountMinor, 0n),
          },
        });
      }
      return order;
    });

    const checkout = await provider.createCheckout({
      orderId: order.id,
      amountMinor: pricing.totalMinor,
      currency: "INR",
      buyer: { email: user.email, name: user.name, phone: user.phone },
      notes: { orderId: order.id, userId: user.id },
    });

    await db.payment.create({
      data: {
        orderId: order.id,
        provider: provider.kind,
        providerOrderRef: checkout.providerOrderRef,
        amountMinor: pricing.totalMinor,
        currency: "INR",
        status: "CREATED",
      },
    });

    Sentry.logger.info("checkout created", { orderId: order.id, provider: provider.kind });

    return { orderId: order.id, checkout: checkout.clientPayload };
  });

/**
 * Fast-path confirmation from the browser checkout callback. The webhook is
 * the source of truth; this verifies the signature and fulfills immediately
 * so the user doesn't wait on webhook delivery.
 */
export const confirmCheckout = authActionClient
  .inputSchema(
    z.object({
      orderId: z.string().min(1),
      providerOrderRef: z.string().min(1),
      providerPaymentRef: z.string().min(1),
      signature: z.string().min(1),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const provider = getPaymentProvider();
    const valid = provider.verifyCheckoutSignature({
      providerOrderRef: parsedInput.providerOrderRef,
      providerPaymentRef: parsedInput.providerPaymentRef,
      signature: parsedInput.signature,
    });
    if (!valid) throw new ActionError("Payment verification failed.");

    const order = await db.order.findUnique({ where: { id: parsedInput.orderId } });
    if (!order || order.userId !== ctx.session.user.id) {
      throw new ActionError("Order not found.");
    }

    Sentry.logger.info("checkout confirmed", { orderId: order.id });
    await fulfillPaidOrder({
      orderId: order.id,
      provider: provider.kind,
      providerPaymentRef: parsedInput.providerPaymentRef,
    });

    revalidatePath("/learn");
    revalidatePath("/cart");
    return { ok: true };
  });
