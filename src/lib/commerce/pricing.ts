import "server-only";

import { db } from "@/lib/db";
import {
  computeCartTotals,
  type CouponInput,
  type PricedLineInput,
} from "@/lib/commerce/totals";
import {
  learnerEntitlementsSchema,
  type LearnerEntitlements,
} from "@/lib/validation/entitlements";

export async function getGstRateBps(): Promise<number> {
  const row = await db.platformConfig.findUnique({
    where: { key: "commerce.gstRateBps" },
  });
  return typeof row?.value === "number" ? row.value : 1800;
}

export async function getActiveLearnerEntitlements(
  userId: string | undefined,
): Promise<LearnerEntitlements | null> {
  if (!userId) return null;
  const sub = await db.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "TRIALING"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  if (!sub || sub.plan.audience !== "LEARNER") return null;
  const parsed = learnerEntitlementsSchema.safeParse(sub.plan.entitlements);
  return parsed.success ? parsed.data : null;
}

type ResolvedLine = PricedLineInput & {
  title: string;
  detail: string | null;
  sellerTenantId: string | null;
  priceId: string | null;
  commissionBps: number | null;
  refundWindowDays: number;
  refundableUntilKickoff: boolean;
  courseId?: string;
  cohortId?: string;
  projectId?: string;
  mentorLevel?: "ASSOCIATE" | "SENIOR" | "PRINCIPAL" | null;
};

/**
 * Loads cart items, resolves each to a Price row + display info + seller
 * economics snapshot inputs, and runs the pure totals math.
 */
export async function resolveCartPricing(
  cartId: string,
  opts: { userId?: string; couponCode?: string },
) {
  const items = await db.cartItem.findMany({
    where: { cartId },
    orderBy: { addedAt: "asc" },
    include: {
      course: { include: { tenant: true } },
      cohort: { include: { course: { include: { tenant: true } } } },
      project: { include: { tenant: true } },
      plan: true,
    },
  });

  const resolved: ResolvedLine[] = [];
  for (const item of items) {
    if (item.itemType === "COURSE" && item.course) {
      const price = await db.price.findFirst({
        where: { courseId: item.courseId!, currency: "INR", region: null, active: true },
      });
      if (!price) continue;
      resolved.push({
        cartItemId: item.id,
        itemType: "COURSE",
        unitAmountMinor: price.amountMinor,
        title: item.course.title,
        detail: `Self-paced course · ${item.course.tenant.displayName}`,
        sellerTenantId: item.course.tenantId,
        priceId: price.id,
        commissionBps: item.course.tenant.commissionBps,
        refundWindowDays: item.course.refundWindowDays,
        refundableUntilKickoff: false,
        courseId: item.courseId!,
      });
    } else if (item.itemType === "COHORT_SEAT" && item.cohort) {
      const price = await db.price.findFirst({
        where: { cohortId: item.cohortId!, currency: "INR", region: null, active: true },
      });
      if (!price) continue;
      resolved.push({
        cartItemId: item.id,
        itemType: "COHORT_SEAT",
        unitAmountMinor: price.amountMinor,
        title: `${item.cohort.course.title} — ${item.cohort.name}`,
        detail: `Live cohort seat · starts ${item.cohort.startsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`,
        sellerTenantId: item.cohort.course.tenantId,
        priceId: price.id,
        commissionBps: item.cohort.course.tenant.commissionBps,
        refundWindowDays: item.cohort.course.refundWindowDays,
        refundableUntilKickoff: false,
        cohortId: item.cohortId!,
        courseId: item.cohort.courseId,
      });
    } else if (item.itemType === "PROJECT" && item.project) {
      const mentorLevel = (item.metadata as { mentorLevel?: string } | null)?.mentorLevel as
        | "ASSOCIATE"
        | "SENIOR"
        | "PRINCIPAL"
        | undefined;
      const price =
        (mentorLevel
          ? await db.price.findFirst({
              where: {
                projectId: item.projectId!,
                currency: "INR",
                region: null,
                active: true,
                mentorLevel,
              },
            })
          : null) ??
        (await db.price.findFirst({
          where: {
            projectId: item.projectId!,
            currency: "INR",
            region: null,
            active: true,
            mentorLevel: null,
          },
        }));
      if (!price) continue;
      resolved.push({
        cartItemId: item.id,
        itemType: "PROJECT",
        projectTier: item.project.tier,
        unitAmountMinor: price.amountMinor,
        title: item.project.title,
        detail: `${item.project.tier.toLowerCase()} project · mentor-reviewed${mentorLevel ? ` · ${mentorLevel.toLowerCase()} mentor` : ""}`,
        sellerTenantId: item.project.tenantId,
        priceId: price.id,
        commissionBps: item.project.tenant.commissionBps,
        refundWindowDays: 0,
        refundableUntilKickoff: item.project.refundableUntilKickoff,
        projectId: item.projectId!,
        mentorLevel: mentorLevel ?? null,
      });
    }
    // PLAN items are activated via the pricing page subscribe flow, not cart checkout.
  }

  let coupon: (CouponInput & { id: string; code: string }) | null = null;
  if (opts.couponCode) {
    const row = await db.coupon.findFirst({
      where: { code: { equals: opts.couponCode, mode: "insensitive" }, active: true },
    });
    if (row) {
      const now = new Date();
      const inWindow =
        (!row.startsAt || row.startsAt <= now) && (!row.endsAt || row.endsAt >= now);
      const redemptions = await db.couponRedemption.count({ where: { couponId: row.id } });
      const underCap = row.maxRedemptions == null || redemptions < row.maxRedemptions;
      const mine = opts.userId
        ? await db.couponRedemption.count({
            where: { couponId: row.id, userId: opts.userId },
          })
        : 0;
      const underUserCap = mine < row.maxPerUser;
      if (inWindow && underCap && underUserCap) {
        const applies = (row.appliesTo ?? {}) as { itemTypes?: string[]; minSubtotalMinor?: number };
        coupon = {
          id: row.id,
          code: row.code,
          discountType: row.discountType,
          percentBps: row.percentBps,
          amountMinor: row.amountMinor,
          itemTypes: applies.itemTypes,
          minSubtotalMinor:
            applies.minSubtotalMinor != null ? BigInt(applies.minSubtotalMinor) : null,
        };
      }
    }
  }

  const entitlements = await getActiveLearnerEntitlements(opts.userId);
  const gstRateBps = await getGstRateBps();
  const totals = computeCartTotals({ lines: resolved, entitlements, coupon, gstRateBps });

  const lineMeta = new Map(resolved.map((r) => [r.cartItemId, r]));
  return {
    ...totals,
    gstRateBps,
    coupon,
    appliedEntitlement: Boolean(
      entitlements && (entitlements.alaCarteDiscountBps > 0 || entitlements.capstoneDiscountBps > 0),
    ),
    lines: totals.lines.map((l) => ({ ...l, ...lineMeta.get(l.cartItemId)! })),
  };
}

export type CartPricing = Awaited<ReturnType<typeof resolveCartPricing>>;
