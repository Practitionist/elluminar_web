import "server-only";

import * as Sentry from "@sentry/nextjs";

import { db } from "@/lib/db";
import { markVideoReady, probeVideoReady } from "@/lib/fermion/video";
import {
  processFermionEvent,
  reportWebhookProcessingError,
} from "@/lib/fermion/webhook-handlers";

/**
 * Reconciliation for Fermion state that missed its webhook (issue #52 Phase C,
 * the "M13" job referenced by the webhook route):
 *   1. VideoAssets stuck in UPLOADING/PROCESSING → probe playability; flip to
 *      READY, or FAIL + notify after 72h so creators re-upload.
 *   2. FAILED webhook events → replayed once per daily run until they stick;
 *      repeated failures are surfaced by the existing failing-webhook alert.
 */

const STUCK_AFTER_MS = 24 * 3600_000;
const FAIL_AFTER_MS = 72 * 3600_000;
/** Retry batch size — hitting it means the backlog is growing faster than
 *  the daily cadence drains it and deserves a heads-up. */
const RETRY_BATCH = 25;
/** Events past this many attempts leave the retry window (they stay FAILED
 *  and get surfaced by the daily failing-webhook audit alert) so a handful of
 *  permanently-broken events can't block the oldest-25 batch forever. */
const MAX_WEBHOOK_RETRIES = 10;

export async function reconcileStuckFermionVideos(now = new Date()) {
  const stuck = await db.videoAsset.findMany({
    where: {
      provider: "FERMION",
      status: { in: ["UPLOADING", "PROCESSING"] },
      updatedAt: { lt: new Date(now.getTime() - STUCK_AFTER_MS) },
    },
    take: 50,
    select: {
      id: true,
      providerVideoRef: true,
      title: true,
      uploadedById: true,
      updatedAt: true,
      tenant: { select: { slug: true } },
    },
  });

  const results = { probed: stuck.length, readied: 0, failed: 0 };
  for (const asset of stuck) {
    // Per-asset isolation: one bad row (e.g. a dangling uploader reference)
    // must not abort the sweep for the rest.
    try {
      if (!asset.providerVideoRef) continue;

      if (await probeVideoReady(asset.providerVideoRef)) {
        await markVideoReady(asset.providerVideoRef);
        results.readied++;
        continue;
      }

      if (now.getTime() - asset.updatedAt.getTime() > FAIL_AFTER_MS) {
        // One transaction: later sweeps only pick up UPLOADING/PROCESSING rows,
        // so a notification failure after the status flip would strand the
        // creator with a silently FAILED video and no way to retry the notice.
        // Rolling back keeps the asset eligible for the next sweep.
        await db.$transaction(async (tx) => {
          await tx.videoAsset.updateMany({
            where: { provider: "FERMION", providerVideoRef: asset.providerVideoRef },
            data: { status: "FAILED" },
          });
          if (asset.uploadedById) {
            await tx.notification.create({
              data: {
                userId: asset.uploadedById,
                category: "system",
                title: `Video processing failed: ${asset.title ?? "untitled"}`,
                body: "The upload could not be processed within 72 hours. Please re-upload it from the studio curriculum builder.",
                actionUrl: `/studio/${asset.tenant.slug}/courses`,
              },
            });
          }
        });
        Sentry.captureMessage("fermion video stuck beyond 72h — marked FAILED", {
          level: "warning",
          tags: { vendor: "fermion", job: "reconcile-videos" },
          extra: { videoAssetId: asset.id },
        });
        results.failed++;
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { vendor: "fermion", job: "reconcile-videos" },
        extra: { videoAssetId: asset.id },
      });
    }
  }
  return results;
}

function eventParts(row: { payload: unknown; eventType: string }) {
  const payload = row.payload as Record<string, unknown>;
  const envelope = payload as {
    eventType?: string;
    event?: string;
    type?: string;
    payload?: Record<string, unknown>;
    data?: Record<string, unknown>;
  };
  const inner = (envelope.payload ?? envelope.data ?? payload) as Record<string, unknown>;
  const eventType = String(
    envelope.eventType ?? envelope.event ?? envelope.type ?? row.eventType,
  );
  return { eventType, data: inner };
}

export async function retryFailedFermionWebhooks() {
  const failed = await db.webhookEvent.findMany({
    where: {
      provider: "FERMION",
      status: "FAILED",
      attempts: { lt: MAX_WEBHOOK_RETRIES },
    },
    orderBy: { receivedAt: "asc" },
    take: RETRY_BATCH,
  });

  if (failed.length >= RETRY_BATCH) {
    Sentry.captureMessage("fermion webhook retry backlog at batch limit", {
      level: "warning",
      tags: { vendor: "fermion", job: "reconcile-webhooks" },
      extra: { batchSize: RETRY_BATCH },
    });
  }

  let recovered = 0;
  for (const event of failed) {
    try {
      const { eventType, data } = eventParts(event);
      await processFermionEvent(eventType, data);
      await db.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          attempts: { increment: 1 },
          error: null,
        },
      });
      recovered++;
    } catch (err) {
      await db.webhookEvent.update({
        where: { id: event.id },
        data: { attempts: { increment: 1 }, error: err instanceof Error ? err.message : String(err) },
      });
      reportWebhookProcessingError(err, event.eventType);
    }
  }
  return { retried: failed.length, recovered };
}
