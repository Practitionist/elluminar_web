import "server-only";

import { db } from "@/lib/db";
import { writeLedgerEntry } from "@/lib/commerce/fulfillment";
import { getGstRateBps } from "@/lib/commerce/pricing";
import { canAfford, computeConsumptionEconomics } from "@/lib/enterprise/credit-math";

export class RedemptionError extends Error {}

/**
 * Credit-pool redemption — the flagged concurrency hot spot. One transaction:
 * FOR UPDATE lock on the license row → Σ consumption → balance check at the
 * current catalog price → consumption insert (uniques absorb double-submit)
 * → enrollment/instance → ledger postings identical to a retail sale.
 */
export async function redeemFromCreditPool(input: {
  licenseId: string;
  userId: string;
  itemType: "COURSE" | "PROJECT";
  courseId?: string;
  projectId?: string;
}) {
  const gstRateBps = await getGstRateBps();

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "OrgLicense" WHERE id = ${input.licenseId} FOR UPDATE`;

    const license = await tx.orgLicense.findUniqueOrThrow({
      where: { id: input.licenseId },
    });
    const now = new Date();
    if (
      license.kind !== "CREDIT_POOL" ||
      license.status !== "ACTIVE" ||
      license.startsAt > now ||
      license.endsAt < now
    ) {
      throw new RedemptionError("This credit pool isn't active.");
    }
    // Redeemer must belong to the org.
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: license.tenantId } });
    const membership = await tx.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId: tenant.organizationId,
          userId: input.userId,
        },
      },
    });
    if (!membership) throw new RedemptionError("You're not a member of this organization.");

    // Current catalog price + seller economics inputs.
    let grossMinor: bigint;
    let sellerTenantId: string;
    let commissionBps: number;
    let title: string;
    if (input.itemType === "COURSE") {
      if (!input.courseId) throw new RedemptionError("Missing course.");
      const course = await tx.course.findUniqueOrThrow({
        where: { id: input.courseId },
        include: { tenant: true },
      });
      if (course.status !== "PUBLISHED") throw new RedemptionError("Course unavailable.");
      const price = await tx.price.findFirst({
        where: { courseId: course.id, currency: "INR", region: null, active: true },
      });
      if (!price) throw new RedemptionError("Course has no price.");
      grossMinor = price.amountMinor;
      sellerTenantId = course.tenantId;
      commissionBps = course.tenant.commissionBps;
      title = course.title;
    } else {
      if (!input.projectId) throw new RedemptionError("Missing project.");
      const project = await tx.project.findUniqueOrThrow({
        where: { id: input.projectId },
        include: { tenant: true },
      });
      if (project.status !== "PUBLISHED") throw new RedemptionError("Project unavailable.");
      const price = await tx.price.findFirst({
        where: {
          projectId: project.id,
          currency: "INR",
          region: null,
          active: true,
          mentorLevel: null,
        },
      });
      if (!price) throw new RedemptionError("Project has no price.");
      grossMinor = price.amountMinor;
      sellerTenantId = project.tenantId;
      commissionBps = project.tenant.commissionBps;
      title = project.title;
    }

    const consumptions = await tx.licenseConsumption.aggregate({
      where: { licenseId: license.id },
      _sum: { amountMinor: true },
    });
    const consumed = consumptions._sum.amountMinor ?? 0n;
    if (!canAfford(license.contractValueMinor ?? 0n, consumed, grossMinor)) {
      throw new RedemptionError(
        "Insufficient pool balance for this item — contact your admin.",
      );
    }

    // Per-user double-redeem guard is also enforced by the unique constraints.
    const consumption = await tx.licenseConsumption
      .create({
        data: {
          licenseId: license.id,
          userId: input.userId,
          itemType: input.itemType,
          courseId: input.itemType === "COURSE" ? input.courseId : null,
          projectId: input.itemType === "PROJECT" ? input.projectId : null,
          amountMinor: grossMinor,
        },
      })
      .catch(() => {
        throw new RedemptionError("You've already redeemed this item from the pool.");
      });

    // Fulfillment
    let enrollmentId: string | null = null;
    let projectInstanceId: string | null = null;
    if (input.itemType === "COURSE") {
      const existing = await tx.enrollment.findFirst({
        where: { userId: input.userId, courseId: input.courseId!, cohortId: null },
      });
      if (existing) {
        // Already enrolled (e.g. personal purchase) — keep it; the pool paid anyway
        // was prevented above by the unique, so this only happens across sources.
        enrollmentId = existing.id;
      } else {
        const enrollment = await tx.enrollment.create({
          data: {
            userId: input.userId,
            courseId: input.courseId!,
            source: "ORG_LICENSE",
            orgLicenseId: license.id,
            expiresAt: license.endsAt,
          },
        });
        enrollmentId = enrollment.id;
      }
    } else {
      const instance = await tx.projectInstance.create({
        data: {
          projectId: input.projectId!,
          userId: input.userId,
          source: "ORG_LICENSE",
          requestedMentorLevel: null,
        },
      });
      projectInstanceId = instance.id;
      await tx.project.update({
        where: { id: input.projectId! },
        data: { purchaseCount: { increment: 1 } },
      });
    }
    await tx.licenseConsumption.update({
      where: { id: consumption.id },
      data: { enrollmentId, projectInstanceId },
    });

    // Creator economics — identical to a retail sale of the same item.
    const economics = computeConsumptionEconomics({ grossMinor, gstRateBps, commissionBps });
    await writeLedgerEntry(tx, {
      account: { ownerType: "TENANT", tenantId: sellerTenantId },
      entryType: "SALE_EARNING",
      amountMinor: economics.sellerEarningsMinor,
      memo: `Credit-pool redemption: ${title}`,
      idempotencyKey: `lic-consume:${consumption.id}`,
    });
    if (economics.platformFeeMinor > 0n) {
      await writeLedgerEntry(tx, {
        account: { ownerType: "PLATFORM" },
        entryType: "PLATFORM_FEE",
        amountMinor: economics.platformFeeMinor,
        memo: `Commission on pool redemption: ${title}`,
        idempotencyKey: `lic-fee:${consumption.id}`,
      });
    }

    return { consumptionId: consumption.id, enrollmentId, projectInstanceId, title };
  });
}
