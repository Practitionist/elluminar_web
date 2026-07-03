import "server-only";

import { db } from "@/lib/db";
import { getActiveLearnerEntitlements } from "@/lib/commerce/pricing";

/**
 * Access resolution for course content:
 *  1. an ACTIVE enrollment (purchase, program, license, admin grant), else
 *  2. an active subscription with libraryAccess → a subscription-sourced
 *     enrollment is created lazily (and expired on lapse via subscriptionId).
 */
export async function resolveCourseAccess(userId: string, courseId: string) {
  const existing = await db.enrollment.findFirst({
    where: { userId, courseId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return { access: true as const, enrollment: existing };

  const entitlements = await getActiveLearnerEntitlements(userId);
  if (entitlements?.libraryAccess) {
    const sub = await db.subscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "TRIALING"] } },
      orderBy: { createdAt: "desc" },
    });
    if (sub) {
      const enrollment = await db.enrollment.create({
        data: {
          userId,
          courseId,
          source: "SUBSCRIPTION",
          subscriptionId: sub.id,
          expiresAt: sub.currentPeriodEnd,
        },
      });
      return { access: true as const, enrollment };
    }
  }
  return { access: false as const, enrollment: null };
}

export async function getActiveSubscriptionWithPlan(userId: string) {
  return db.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE", "PAUSED"] } },
    include: { plan: true, credits: { orderBy: { periodKey: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
}
