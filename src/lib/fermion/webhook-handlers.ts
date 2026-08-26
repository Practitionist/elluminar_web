import "server-only";

import crypto from "node:crypto";

import * as Sentry from "@sentry/nextjs";

import { env } from "@/env";
import { db } from "@/lib/db";
import { markVideoReady } from "@/lib/fermion/video";

/**
 * Fermion webhook event processing — shared between the HTTP intake route and
 * the reconciliation job that replays FAILED events.
 *
 * Event shapes follow docs.fermion.app/webhooks:
 *   { eventUniqueId, timestampIsoString, isTestEvent,
 *     payload: { eventType, ...eventData } }
 */

type LabChallenge = {
  challengeId: string;
  isChallengePassed: boolean;
  challengeLabel: string;
};

type LabRunTestsPayload = {
  eventType: "lab-run-tests";
  internalUserId?: string;
  apiUserId?: string | null;
  labId?: string;
  challengeResult?:
    | { isLabAttempted: true; result: LabChallenge[] }
    | { isLabAttempted: false };
};

/** Resolves our user for a lab event: apiUserId first, then identity mapping. */
async function resolveUserIdForLabEvent(data: LabRunTestsPayload) {
  if (data.apiUserId) {
    const known = await db.user.findUnique({
      where: { id: data.apiUserId },
      select: { id: true },
    });
    if (known) return known.id;
  }
  if (data.internalUserId) {
    const identity = await db.userProviderIdentity.findUnique({
      where: {
        provider_externalRef: { provider: "FERMION", externalRef: data.internalUserId },
      },
      select: { userId: true },
    });
    if (identity) return identity.userId;
  }
  return null;
}

/**
 * Stores a lab-run result on the learner's most recent SandboxSession for that
 * lab (store-results-only policy: grading hookup is deliberately out of scope).
 */
export async function recordLabRunResults(data: LabRunTestsPayload) {
  const labId = data.labId ? String(data.labId) : "";
  if (!labId) return;

  const userId = await resolveUserIdForLabEvent(data);
  if (!userId) return; // unattributable — drop rather than guess

  const challenges = Array.isArray(
    (data.challengeResult as { result?: LabChallenge[] } | undefined)?.result,
  )
    ? (data.challengeResult as { isLabAttempted: true; result: LabChallenge[] }).result
    : [];
  const passedCount = challenges.filter((c) => c.isChallengePassed).length;
  const endedAt = new Date();

  const latest = await db.sandboxSession.findFirst({
    where: { provider: "FERMION", providerRef: labId, userId },
    orderBy: { startedAt: "desc" },
  });

  // Optimistic postMessage results are never trusted here — this webhook is
  // the server-side source of truth.
  const metadata = {
    lastResultAt: endedAt.toISOString(),
    totalChallengesCount: challenges.length,
    passedChallengesCount: passedCount,
    challenges: challenges.map((c) => ({
      challengeId: c.challengeId,
      challengeLabel: c.challengeLabel,
      isChallengePassed: c.isChallengePassed,
    })),
  };

  if (latest) {
    await db.sandboxSession.update({
      where: { id: latest.id },
      data: {
        endedAt,
        durationSec: Math.max(
          0,
          Math.round((endedAt.getTime() - latest.startedAt.getTime()) / 1000),
        ),
        metadata,
      },
    });
  } else {
    // Event arrived without a matching launch session (e.g. replay after data
    // loss) — record it anyway so metering stays complete.
    await db.sandboxSession.create({
      data: {
        userId,
        kind: "INTERACTIVE_LAB",
        provider: "FERMION",
        providerRef: labId,
        endedAt,
        metadata,
      },
    });
  }
}

/**
 * Verifies the shared secret Fermion sends in the `X-Fermion-Webhook-Secret`
 * header (constant-time comparison, length-guarded).
 *
 * When no secret is configured the check reports "not-configured": the HTTP
 * intake must FAIL CLOSED in production (reject with 503) and may only accept
 * unverified events outside production so local development works without a
 * Fermion account.
 */
export function checkWebhookSecret(provided: string | null): {
  ok: boolean;
  reason: "not-configured" | "invalid" | "valid";
} {
  const expected = env.FERMION_WEBHOOK_SECRET;
  if (!expected) return { ok: false, reason: "not-configured" };
  // Compare byte lengths (UTF-8), not JS string lengths (UTF-16 code units) —
  // a multi-byte header value can match on .length yet differ in bytes.
  if (
    !provided ||
    Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
    !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, reason: "valid" };
}

/**
 * Dispatches one event's data. Unknown event types are acknowledged without
 * action so novel Fermion events never break intake.
 */
export async function processFermionEvent(
  eventType: string,
  data: Record<string, unknown>,
) {
  switch (eventType) {
    case "recoded-video-ready-for-playback": {
      const videoId = String((data as { videoId?: unknown }).videoId ?? "");
      if (videoId) await markVideoReady(videoId, data);
      return;
    }
    case "lab-run-tests":
      await recordLabRunResults(data as unknown as LabRunTestsPayload);
      return;
    default: {
      // Legacy/heuristic shapes (kept for robustness against undocumented
      // variants): any video-ish event with an explicit failure status flips
      // the asset to FAILED; explicit ready statuses mark it READY.
      if (!eventType.includes("video")) return;
      const ref = String(
        ((data as { videoId?: unknown }).videoId ??
          (data as { videoRef?: unknown }).videoRef) ??
          "",
      );
      if (!ref) return;
      const status = String((data as { status?: unknown }).status ?? "").toLowerCase();
      if (status.includes("fail")) {
        await db.videoAsset.updateMany({
          where: { provider: "FERMION", providerVideoRef: ref },
          data: { status: "FAILED" },
        });
      } else if (status.includes("ready") || status.includes("complete")) {
        await markVideoReady(ref, data);
      }
    }
  }
}

export function reportWebhookProcessingError(err: unknown, eventType: string) {
  Sentry.captureException(err, { tags: { webhook: "fermion", eventType } });
}
