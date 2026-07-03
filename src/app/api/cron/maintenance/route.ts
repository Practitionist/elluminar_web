import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";
import { grantPeriodCredits } from "@/lib/commerce/subscriptions";
import { db } from "@/lib/db";

/**
 * Daily maintenance (invoked by the Netlify scheduled function with CRON_SECRET):
 *  1. expire enrollments whose subscription lapsed past its period end
 *  2. re-grant period credits for active subscriptions (new period keys)
 *  3. abandon stale carts; expire stale pending orders
 *  4. surface (don't retry) repeatedly-failing webhook events
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const results = await Sentry.withMonitor(
      "daily-maintenance",
      async () => {
        const now = new Date();
        const results: Record<string, number> = {};

        // 1. Lapsed subscriptions past their paid period → expire their enrollments.
        const lapsed = await db.subscription.findMany({
          where: {
            status: { in: ["PAST_DUE", "CANCELLED", "EXPIRED"] },
            currentPeriodEnd: { lt: now },
            enrollments: { some: { status: "ACTIVE" } },
          },
          select: { id: true },
        });
        for (const sub of lapsed) {
          const updated = await db.enrollment.updateMany({
            where: { subscriptionId: sub.id, status: "ACTIVE" },
            data: { status: "EXPIRED", expiresAt: now },
          });
          results.enrollmentsExpired = (results.enrollmentsExpired ?? 0) + updated.count;
        }

        // 2. Fresh period credits for active subscriptions.
        const active = await db.subscription.findMany({
          where: { status: { in: ["ACTIVE", "TRIALING"] } },
          select: { id: true },
        });
        for (const sub of active) {
          await grantPeriodCredits(sub.id);
        }
        results.creditsRefreshed = active.length;

        // 3. Stale carts + expired pending orders.
        const staleCarts = await db.cart.updateMany({
          where: {
            status: "ACTIVE",
            updatedAt: { lt: new Date(now.getTime() - 30 * 86400_000) },
          },
          data: { status: "ABANDONED" },
        });
        results.cartsAbandoned = staleCarts.count;
        const expiredOrders = await db.order.updateMany({
          where: { status: "PENDING_PAYMENT", expiresAt: { lt: now } },
          data: { status: "EXPIRED" },
        });
        results.ordersExpired = expiredOrders.count;

        // 4. Repeatedly-failing webhooks → notify admins via AuditLog (alerting: issue #11).
        const failing = await db.webhookEvent.count({
          where: { status: "FAILED", attempts: { gte: 3 } },
        });
        if (failing > 0) {
          await db.auditLog.create({
            data: {
              actorKind: "SYSTEM",
              action: "cron.webhooks.failing",
              entityType: "WebhookEvent",
              entityId: "aggregate",
              after: { count: failing },
            },
          });
        }
        results.failingWebhooks = failing;

        // 5. Enterprise licenses past their end date → EXPIRED + expire exactly
        //    the enrollments they granted (orgLicenseId attribution).
        const expiredLicenses = await db.orgLicense.findMany({
          where: { status: "ACTIVE", endsAt: { lt: now } },
          select: { id: true },
        });
        if (expiredLicenses.length > 0) {
          const ids = expiredLicenses.map((l) => l.id);
          await db.orgLicense.updateMany({
            where: { id: { in: ids } },
            data: { status: "EXPIRED" },
          });
          const expired = await db.enrollment.updateMany({
            where: { orgLicenseId: { in: ids }, status: "ACTIVE" },
            data: { status: "EXPIRED", expiresAt: now },
          });
          results.licensesExpired = ids.length;
          results.licensedEnrollmentsExpired = expired.count;
        }

        // 6. Generic safety sweep: any ACTIVE enrollment past its expiry.
        const swept = await db.enrollment.updateMany({
          where: { status: "ACTIVE", expiresAt: { lt: now } },
          data: { status: "EXPIRED" },
        });
        results.expiredEnrollmentsSwept = swept.count;

        // 7. Stuck report exports (after() cut short) → regenerate.
        const stuckReports = await db.reportExport.findMany({
          where: {
            status: { in: ["QUEUED", "RUNNING"] },
            createdAt: { lt: new Date(now.getTime() - 15 * 60_000) },
          },
          take: 5,
          select: { id: true },
        });
        for (const r of stuckReports) {
          const { generateReport } = await import("@/lib/enterprise/reports");
          await generateReport(r.id).catch(() => undefined);
        }
        results.reportsRetried = stuckReports.length;

        // 8. License renewal horizon (30 days) → surface for CS follow-up.
        const renewalsDue = await db.orgLicense.count({
          where: {
            status: "ACTIVE",
            endsAt: { gte: now, lte: new Date(now.getTime() + 30 * 86400_000) },
          },
        });
        if (renewalsDue > 0) {
          await db.auditLog.create({
            data: {
              actorKind: "SYSTEM",
              action: "cron.licenses.renewals_due",
              entityType: "OrgLicense",
              entityId: "aggregate",
              after: { count: renewalsDue },
            },
          });
        }
        results.renewalsDue = renewalsDue;

        return results;
      },
      {
        schedule: { type: "crontab", value: "0 0 * * *" },
        timezone: "Etc/UTC",
      },
    );

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: "daily-maintenance" } });
    return NextResponse.json({ error: "maintenance failed" }, { status: 500 });
  }
}
