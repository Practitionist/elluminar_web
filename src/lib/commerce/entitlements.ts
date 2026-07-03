import "server-only";

import { db } from "@/lib/db";
import { getActiveLearnerEntitlements } from "@/lib/commerce/pricing";

/**
 * Access resolution for course content:
 *  1. an ACTIVE, unexpired enrollment (purchase, program, license, grant), else
 *  2. an ACTIVATED seat on an in-window CATALOG license whose scope covers the
 *     course → lazy Enrollment(source ORG_LICENSE, expires with the license), else
 *  3. an active subscription with libraryAccess → lazy Enrollment(SUBSCRIPTION).
 * CREDIT_POOL licenses never grant lazily — redemption spends money and is
 * always an explicit action (src/lib/enterprise/credit.ts).
 */
export async function resolveCourseAccess(userId: string, courseId: string) {
  const now = new Date();
  const existing = await db.enrollment.findFirst({
    where: {
      userId,
      courseId,
      status: "ACTIVE",
      // Expiry guard: a lapsed-but-unswept enrollment must not grant access.
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return { access: true as const, enrollment: existing };

  // CATALOG seat access (never CREDIT_POOL — those redeem explicitly).
  const seat = await db.licenseSeat.findFirst({
    where: {
      userId,
      status: "ACTIVATED",
      license: {
        kind: "CATALOG",
        status: "ACTIVE",
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    },
    include: { license: true },
    orderBy: { activatedAt: "desc" },
  });
  if (seat) {
    const scope = (seat.license.catalogScope ?? {}) as { courseIds?: string[] };
    const covered = !scope.courseIds?.length || scope.courseIds.includes(courseId);
    if (covered) {
      const enrollment = await db.enrollment.create({
        data: {
          userId,
          courseId,
          source: "ORG_LICENSE",
          orgLicenseId: seat.licenseId,
          expiresAt: seat.license.endsAt,
        },
      });
      return { access: true as const, enrollment };
    }
  }

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
