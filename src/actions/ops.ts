"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { writeLedgerEntry } from "@/lib/commerce/fulfillment";
import { ActionError, adminActionClient, tenantActionClient } from "@/lib/safe-action";
import { slugSchema } from "@/lib/validation/tenant";

/** Manual payout recording (bank/UPI executed outside; RazorpayX automation is issue #14). */
export const recordPayout = adminActionClient
  .inputSchema(
    z.object({
      ledgerAccountId: z.string().min(1),
      amountRupees: z.number().positive(),
      reference: z.string().max(120).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const account = await db.ledgerAccount.findUnique({
      where: { id: parsedInput.ledgerAccountId },
    });
    if (!account) throw new ActionError("Account not found.");
    const amountMinor = BigInt(Math.round(parsedInput.amountRupees * 100));
    if (amountMinor > account.balanceCachedMinor) {
      throw new ActionError("Amount exceeds the account balance.");
    }

    await db.$transaction(async (tx) => {
      const payout = await tx.payout.create({
        data: {
          accountId: account.id,
          amountMinor,
          currency: account.currency,
          status: "PAID",
          method: "MANUAL",
          providerRef: parsedInput.reference,
          initiatedById: ctx.session.user.id,
          approvedById: ctx.session.user.id,
          processedAt: new Date(),
        },
      });
      await writeLedgerEntry(tx, {
        account:
          account.ownerType === "TENANT"
            ? { ownerType: "TENANT", tenantId: account.tenantId! }
            : account.ownerType === "MENTOR"
              ? { ownerType: "MENTOR", mentorProfileId: account.mentorProfileId! }
              : account.ownerType === "USER"
                ? { ownerType: "USER", userId: account.userId! }
                : { ownerType: "PLATFORM" },
        entryType: "PAYOUT",
        amountMinor: -amountMinor,
        currency: account.currency,
        payoutId: payout.id,
        memo: parsedInput.reference ?? "Manual payout",
        idempotencyKey: `payout:${payout.id}`,
      });
    });

    revalidatePath("/admin/payouts");
    return { ok: true };
  });

export const toggleFeatureFlag = adminActionClient
  .inputSchema(z.object({ key: z.string().min(1), enabled: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    await db.featureFlag.update({
      where: { key: parsedInput.key },
      data: { enabled: parsedInput.enabled, updatedById: ctx.session.user.id },
    });
    revalidatePath("/admin/flags");
    return { ok: true };
  });

const couponBase = {
  code: z.string().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
  name: z.string().min(2).max(120),
  discountType: z.enum(["PERCENT", "FIXED_AMOUNT"]),
  percentOff: z.number().min(1).max(100).optional(),
  amountOffRupees: z.number().positive().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  endsAt: z.coerce.date().optional().nullable(),
};

export const createPlatformCoupon = adminActionClient
  .inputSchema(z.object(couponBase))
  .action(async ({ parsedInput, ctx }) => {
    await createCouponRow({ ...parsedInput, tenantId: null, createdById: ctx.session.user.id });
    revalidatePath("/admin/coupons");
    return { ok: true };
  });

export const createTenantCoupon = tenantActionClient(["owner", "admin"])
  .inputSchema(z.object({ tenantSlug: slugSchema, ...couponBase }))
  .action(async ({ parsedInput, ctx }) => {
    await createCouponRow({
      ...parsedInput,
      tenantId: ctx.tenant.id,
      createdById: ctx.session.user.id,
    });
    revalidatePath(`/studio/${ctx.tenant.slug}/coupons`);
    return { ok: true };
  });

async function createCouponRow(input: {
  code: string;
  name: string;
  discountType: "PERCENT" | "FIXED_AMOUNT";
  percentOff?: number;
  amountOffRupees?: number;
  maxRedemptions?: number;
  endsAt?: Date | null;
  tenantId: string | null;
  createdById: string;
}) {
  if (input.discountType === "PERCENT" && !input.percentOff) {
    throw new ActionError("Set a percent discount.");
  }
  if (input.discountType === "FIXED_AMOUNT" && !input.amountOffRupees) {
    throw new ActionError("Set an amount off.");
  }
  const existing = await db.coupon.findFirst({
    where: { code: { equals: input.code, mode: "insensitive" } },
  });
  if (existing) throw new ActionError("That code is taken.");

  await db.coupon.create({
    data: {
      code: input.code.toUpperCase(),
      tenantId: input.tenantId,
      name: input.name,
      discountType: input.discountType,
      percentBps: input.percentOff ? input.percentOff * 100 : null,
      amountMinor: input.amountOffRupees
        ? BigInt(Math.round(input.amountOffRupees * 100))
        : null,
      currency: input.discountType === "FIXED_AMOUNT" ? "INR" : null,
      maxRedemptions: input.maxRedemptions,
      endsAt: input.endsAt,
      createdById: input.createdById,
      // Tenant coupons apply only to that tenant's own catalog.
      appliesTo: input.tenantId ? { tenantIds: [input.tenantId] } : undefined,
    },
  });
}
