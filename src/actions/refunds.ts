"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { writeLedgerEntry } from "@/lib/commerce/fulfillment";
import { getPaymentProvider } from "@/lib/payments";
import { ActionError, adminActionClient, authActionClient } from "@/lib/safe-action";

/**
 * 14-day guarded refunds (user decision):
 * - Courses/cohort seats: within OrderItem.refundableUntil, void once >30% of
 *   content is consumed or a certificate was issued. Cohort seats additionally
 *   only until the cohort starts.
 * - Projects: only while the instance is PENDING_KICKOFF (mentorKickoffAt unset).
 */
export const requestRefund = authActionClient
  .inputSchema(
    z.object({
      orderItemId: z.string().min(1),
      note: z.string().max(1000).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const item = await db.orderItem.findUnique({
      where: { id: parsedInput.orderItemId },
      include: {
        order: true,
        enrollments: { include: { lessonProgress: true, course: { include: { lessons: true } } } },
        projectInstances: true,
        refunds: true,
      },
    });
    if (!item || item.order.userId !== ctx.session.user.id) {
      throw new ActionError("Order item not found.");
    }
    if (item.order.status !== "PAID" && item.order.status !== "PARTIALLY_REFUNDED") {
      throw new ActionError("This order isn't refundable.");
    }
    if (item.fulfillmentStatus === "REFUNDED") {
      throw new ActionError("Already refunded.");
    }
    if (item.refunds.some((r) => ["REQUESTED", "APPROVED", "PROCESSING"].includes(r.status))) {
      throw new ActionError("A refund request is already open for this item.");
    }

    let reason: "WITHIN_WINDOW" | "PRE_KICKOFF" = "WITHIN_WINDOW";

    if (item.itemType === "PROJECT") {
      const instance = item.projectInstances[0];
      if (!instance || instance.status !== "PENDING_KICKOFF" || instance.mentorKickoffAt) {
        throw new ActionError(
          "Projects are refundable only before your mentor kickoff call.",
        );
      }
      reason = "PRE_KICKOFF";
    } else {
      if (!item.refundableUntil || item.refundableUntil < new Date()) {
        throw new ActionError("The refund window for this item has closed.");
      }
      const enrollment = item.enrollments[0];
      if (enrollment) {
        const totalLessons = enrollment.course.lessons.length;
        const completed = enrollment.lessonProgress.filter(
          (p) => p.status === "COMPLETED",
        ).length;
        if (totalLessons > 0 && completed / totalLessons > 0.3) {
          throw new ActionError(
            "Refunds aren't available once more than 30% of the course is completed.",
          );
        }
        if (enrollment.completedAt) {
          throw new ActionError("Completed courses aren't refundable.");
        }
        if (enrollment.cohortId) {
          const cohort = await db.cohort.findUnique({ where: { id: enrollment.cohortId } });
          if (cohort && cohort.startsAt <= new Date()) {
            throw new ActionError("Cohort seats aren't refundable after the cohort starts.");
          }
        }
      }
    }

    const payment = await db.payment.findFirst({
      where: { orderId: item.orderId, status: "CAPTURED" },
    });
    if (!payment) throw new ActionError("No captured payment found for this order.");

    await db.refund.create({
      data: {
        paymentId: payment.id,
        orderItemId: item.id,
        kind: "ITEM",
        amountMinor: item.totalMinor,
        currency: item.order.currency,
        reason,
        note: parsedInput.note,
        status: "REQUESTED",
        requestedById: ctx.session.user.id,
      },
    });

    revalidatePath("/learn/orders");
    return { ok: true };
  });

/** Admin decision + provider processing + reversals, in one transactional flow. */
export const decideRefund = adminActionClient
  .inputSchema(
    z.object({
      refundId: z.string().min(1),
      decision: z.enum(["APPROVED", "REJECTED"]),
      note: z.string().max(1000).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const refund = await db.refund.findUnique({
      where: { id: parsedInput.refundId },
      include: {
        payment: true,
        orderItem: {
          include: { order: true, enrollments: true, projectInstances: true },
        },
      },
    });
    if (!refund || refund.status !== "REQUESTED") {
      throw new ActionError("Refund not found or already decided.");
    }

    if (parsedInput.decision === "REJECTED") {
      await db.refund.update({
        where: { id: refund.id },
        data: {
          status: "REJECTED",
          decidedById: ctx.session.user.id,
          decidedAt: new Date(),
          note: parsedInput.note ?? refund.note,
        },
      });
      revalidatePath("/admin/refunds");
      return { ok: true };
    }

    await db.refund.update({
      where: { id: refund.id },
      data: {
        status: "PROCESSING",
        decidedById: ctx.session.user.id,
        decidedAt: new Date(),
      },
    });

    // Provider refund outside the DB transaction (network call).
    const provider = getPaymentProvider();
    let providerRefundRef: string | null = null;
    let raw: unknown = null;
    if (refund.payment.provider === "RAZORPAY" && refund.payment.providerPaymentRef) {
      const result = await provider.refund({
        providerPaymentRef: refund.payment.providerPaymentRef,
        amountMinor: refund.amountMinor,
        notes: { refundId: refund.id },
      });
      providerRefundRef = result.providerRefundRef;
      raw = result.raw;
    }

    await db.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: "PROCESSED",
          providerRefundRef,
          processedAt: new Date(),
          raw: (raw as object) ?? undefined,
        },
      });

      const item = refund.orderItem;
      if (item) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: { fulfillmentStatus: "REFUNDED" },
        });
        // Revoke access
        await tx.enrollment.updateMany({
          where: { orderItemId: item.id },
          data: { status: "REVOKED" },
        });
        await tx.projectInstance.updateMany({
          where: { orderItemId: item.id },
          data: { status: "REFUNDED" },
        });

        // Claw back seller earnings + platform fee
        if (item.sellerTenantId && item.sellerEarningsMinor != null) {
          await writeLedgerEntry(tx, {
            account: { ownerType: "TENANT", tenantId: item.sellerTenantId },
            entryType: "REFUND_REVERSAL",
            amountMinor: -item.sellerEarningsMinor,
            orderItemId: item.id,
            refundId: refund.id,
            memo: `Refund: ${item.titleSnapshot}`,
            idempotencyKey: `refund-seller:${refund.id}`,
          });
        }
        if (item.platformFeeMinor != null && item.platformFeeMinor > 0n) {
          await writeLedgerEntry(tx, {
            account: { ownerType: "PLATFORM" },
            entryType: "REFUND_REVERSAL",
            amountMinor: -item.platformFeeMinor,
            orderItemId: item.id,
            refundId: refund.id,
            memo: `Refund fee reversal: ${item.titleSnapshot}`,
            idempotencyKey: `refund-fee:${refund.id}`,
          });
        }

        // Order status
        const remaining = await tx.orderItem.count({
          where: { orderId: item.orderId, fulfillmentStatus: { not: "REFUNDED" } },
        });
        await tx.order.update({
          where: { id: item.orderId },
          data: { status: remaining === 0 ? "REFUNDED" : "PARTIALLY_REFUNDED" },
        });

        // GST credit note
        const series = "CN";
        const rows = await tx.$queryRaw<Array<{ nextNumber: number }>>`
          UPDATE "InvoiceSeries" SET "nextNumber" = "nextNumber" + 1, "updatedAt" = now()
          WHERE series = ${series}
          RETURNING "nextNumber" - 1 AS "nextNumber"
        `;
        const n = rows[0]?.nextNumber ?? 1;
        await tx.invoice.create({
          data: {
            kind: "CREDIT_NOTE",
            paymentId: refund.paymentId,
            refundId: refund.id,
            number: `CN-${new Date().getFullYear()}-${String(n).padStart(6, "0")}`,
            series,
            data: {
              refundAmountMinor: refund.amountMinor.toString(),
              orderItemTitle: item.titleSnapshot,
            },
          },
        });

        await tx.notification.create({
          data: {
            userId: refund.orderItem!.order.userId,
            category: "refund",
            title: "Refund processed",
            body: `Your refund for "${item.titleSnapshot}" is on its way (5–7 business days).`,
            actionUrl: "/learn/orders",
          },
        });
      }
    });

    revalidatePath("/admin/refunds");
    return { ok: true };
  });
