import "server-only";

import { db } from "@/lib/db";
import { applyBps } from "@/lib/money";

import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

async function ensureLedgerAccount(
  tx: Tx,
  owner:
    | { ownerType: "PLATFORM" }
    | { ownerType: "TENANT"; tenantId: string }
    | { ownerType: "MENTOR"; mentorProfileId: string }
    | { ownerType: "USER"; userId: string },
  currency = "INR",
) {
  const where =
    owner.ownerType === "PLATFORM"
      ? { ownerType: "PLATFORM" as const, currency }
      : owner.ownerType === "TENANT"
        ? { ownerType: "TENANT" as const, tenantId: owner.tenantId, currency }
        : owner.ownerType === "MENTOR"
          ? { ownerType: "MENTOR" as const, mentorProfileId: owner.mentorProfileId, currency }
          : { ownerType: "USER" as const, userId: owner.userId, currency };

  const existing = await tx.ledgerAccount.findFirst({ where });
  if (existing) return existing;
  return tx.ledgerAccount.create({ data: where });
}

export async function writeLedgerEntry(
  tx: Tx,
  input: {
    account: Parameters<typeof ensureLedgerAccount>[1];
    entryType:
      | "SALE_EARNING"
      | "SUBSCRIPTION_EARNING"
      | "PLATFORM_FEE"
      | "REFUND_REVERSAL"
      | "MENTOR_FEE"
      | "MENTOR_FEE_REVERSAL"
      | "PAYOUT"
      | "PAYOUT_REVERSAL"
      | "REFERRAL_REWARD"
      | "ADJUSTMENT";
    amountMinor: bigint;
    currency?: string;
    orderItemId?: string;
    refundId?: string;
    payoutId?: string;
    projectInstanceId?: string;
    subscriptionId?: string;
    memo?: string;
    idempotencyKey?: string;
  },
) {
  const account = await ensureLedgerAccount(tx, input.account, input.currency ?? "INR");
  if (input.idempotencyKey) {
    const dup = await tx.ledgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (dup) return dup;
  }
  const entry = await tx.ledgerEntry.create({
    data: {
      accountId: account.id,
      entryType: input.entryType,
      amountMinor: input.amountMinor,
      currency: input.currency ?? "INR",
      orderItemId: input.orderItemId,
      refundId: input.refundId,
      payoutId: input.payoutId,
      projectInstanceId: input.projectInstanceId,
      subscriptionId: input.subscriptionId,
      memo: input.memo,
      idempotencyKey: input.idempotencyKey,
    },
  });
  await tx.ledgerAccount.update({
    where: { id: account.id },
    data: {
      balanceCachedMinor: { increment: input.amountMinor },
      balanceCachedAt: new Date(),
    },
  });
  return entry;
}

/** Gapless invoice numbering via a row-locked counter. */
async function nextInvoiceNumber(tx: Tx, series: string) {
  const rows = await tx.$queryRaw<Array<{ nextNumber: number }>>`
    UPDATE "InvoiceSeries" SET "nextNumber" = "nextNumber" + 1, "updatedAt" = now()
    WHERE series = ${series}
    RETURNING "nextNumber" - 1 AS "nextNumber"
  `;
  const n = rows[0]?.nextNumber;
  if (n == null) throw new Error(`Invoice series ${series} missing`);
  const year = new Date().getFullYear();
  return `${series}-${year}-${String(n).padStart(6, "0")}`;
}

/**
 * Idempotent order fulfillment — called from the payment webhook (and the
 * checkout-callback verifier as a fast path). Marks the order paid, fans out
 * enrollments/project instances, writes seller/platform ledger entries, and
 * issues the tax invoice.
 */
export async function fulfillPaidOrder(input: {
  orderId: string;
  providerPaymentRef: string;
  provider: "RAZORPAY" | "DODO" | "MANUAL" | "FREE";
  method?: string;
  raw?: unknown;
}) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: input.orderId },
      include: { items: true, user: true },
    });

    // Idempotency: a captured payment for this ref means we already fulfilled.
    const existing = await tx.payment.findFirst({
      where: {
        provider: input.provider,
        providerPaymentRef: input.providerPaymentRef,
        status: "CAPTURED",
      },
    });
    if (existing) return { alreadyFulfilled: true as const, orderId: order.id };

    const payment = await tx.payment.upsert({
      where: {
        provider_providerPaymentRef: {
          provider: input.provider,
          providerPaymentRef: input.providerPaymentRef,
        },
      },
      update: {
        status: "CAPTURED",
        capturedAt: new Date(),
        method: input.method,
        raw: (input.raw as object) ?? undefined,
      },
      create: {
        orderId: order.id,
        provider: input.provider,
        providerPaymentRef: input.providerPaymentRef,
        method: input.method,
        amountMinor: order.totalMinor,
        currency: order.currency,
        status: "CAPTURED",
        capturedAt: new Date(),
        raw: (input.raw as object) ?? undefined,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date() },
    });

    for (const item of order.items) {
      const meta = (item.metadata ?? {}) as { mentorLevel?: string };

      if (item.itemType === "COURSE" && item.courseId) {
        // find-then-create: the composite unique includes a nullable cohortId,
        // so upsert can't target it (and a thrown statement would abort the tx).
        const existing = await tx.enrollment.findFirst({
          where: { userId: order.userId, courseId: item.courseId, cohortId: null },
        });
        if (existing) {
          await tx.enrollment.update({
            where: { id: existing.id },
            data: { status: "ACTIVE", orderItemId: item.id, source: "PURCHASE" },
          });
        } else {
          await tx.enrollment.create({
            data: {
              userId: order.userId,
              courseId: item.courseId,
              source: "PURCHASE",
              orderItemId: item.id,
            },
          });
        }
      }

      if (item.itemType === "COHORT_SEAT" && item.cohortId) {
        const cohort = await tx.cohort.findUniqueOrThrow({ where: { id: item.cohortId } });
        const dup = await tx.enrollment.findFirst({
          where: { userId: order.userId, courseId: cohort.courseId, cohortId: cohort.id },
        });
        if (!dup) {
          await tx.enrollment.create({
            data: {
              userId: order.userId,
              courseId: cohort.courseId,
              cohortId: cohort.id,
              source: "PURCHASE",
              orderItemId: item.id,
            },
          });
        }
      }

      if (item.itemType === "PROJECT" && item.projectId) {
        await tx.projectInstance.create({
          data: {
            projectId: item.projectId,
            userId: order.userId,
            orderItemId: item.id,
            source: "PURCHASE",
            requestedMentorLevel: (meta.mentorLevel as never) ?? null,
          },
        });
        await tx.project.update({
          where: { id: item.projectId },
          data: { purchaseCount: { increment: 1 } },
        });
      }

      // Seller economics (platform SKUs have no seller).
      if (item.sellerTenantId && item.sellerEarningsMinor != null) {
        await writeLedgerEntry(tx, {
          account: { ownerType: "TENANT", tenantId: item.sellerTenantId },
          entryType: "SALE_EARNING",
          amountMinor: item.sellerEarningsMinor,
          orderItemId: item.id,
          memo: item.titleSnapshot,
          idempotencyKey: `sale:${item.id}`,
        });
        if (item.platformFeeMinor != null && item.platformFeeMinor > 0n) {
          await writeLedgerEntry(tx, {
            account: { ownerType: "PLATFORM" },
            entryType: "PLATFORM_FEE",
            amountMinor: item.platformFeeMinor,
            orderItemId: item.id,
            memo: `Commission on ${item.titleSnapshot}`,
            idempotencyKey: `fee:${item.id}`,
          });
        }
      }

      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          fulfillmentStatus: "FULFILLED",
          refundableUntil:
            item.refundWindowDays > 0
              ? new Date(Date.now() + item.refundWindowDays * 86400_000)
              : null,
        },
      });

      if (item.courseId) {
        await tx.course.update({
          where: { id: item.courseId },
          data: { enrollmentCount: { increment: 1 } },
        });
      }
    }

    const invoiceNumber = await nextInvoiceNumber(tx, "INV");
    await tx.invoice.create({
      data: {
        kind: "TAX_INVOICE",
        paymentId: payment.id,
        number: invoiceNumber,
        series: "INV",
        data: {
          orderNo: order.orderNo,
          currency: order.currency,
          subtotalMinor: order.subtotalMinor.toString(),
          discountMinor: order.discountMinor.toString(),
          taxMinor: order.taxMinor.toString(),
          totalMinor: order.totalMinor.toString(),
          items: order.items.map((i) => ({
            title: i.titleSnapshot,
            totalMinor: i.totalMinor.toString(),
            taxMinor: i.taxMinor.toString(),
            taxRateBps: i.taxRateBps,
          })),
          billTo: order.billTo,
        },
      },
    });

    await tx.cart.updateMany({
      where: { userId: order.userId, status: "ACTIVE" },
      data: { status: "CONVERTED", convertedOrderId: order.id },
    });

    await tx.notification.create({
      data: {
        userId: order.userId,
        category: "order",
        title: "Purchase confirmed",
        body: `Order #${order.orderNo} — you're in! Your items are ready in your dashboard.`,
        actionUrl: "/learn",
      },
    });

    return { alreadyFulfilled: false as const, orderId: order.id, paymentId: payment.id };
  });
}
