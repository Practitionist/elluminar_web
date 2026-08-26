import crypto from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";
import { db } from "@/lib/db";
import {
  checkWebhookSecret,
  processFermionEvent,
  reportWebhookProcessingError,
} from "@/lib/fermion/webhook-handlers";

/**
 * Fermion webhook intake (docs.fermion.app/webhooks).
 *
 * Authenticity: Fermion sends the configured secret in the
 * `X-Fermion-Webhook-Secret` header on every event — a plain shared-secret
 * comparison, NOT an HMAC signature. Unconfigured secrets fail closed in
 * production (503); invalid secrets are rejected with 401 everywhere.
 *
 * Envelope: { eventUniqueId, timestampIsoString, isTestEvent,
 *             payload: { eventType, ...eventData } }.
 * Every event lands in WebhookEvent first (idempotent on provider+eventRef,
 * created atomically to survive concurrent deliveries), then is processed;
 * unknown event types are stored and acknowledged.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const secretCheck = checkWebhookSecret(
    request.headers.get("x-fermion-webhook-secret"),
  );
  if (secretCheck.reason === "invalid") {
    Sentry.captureMessage("fermion webhook secret verification failed", {
      level: "warning",
      tags: { webhook: "fermion" },
    });
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }
  if (secretCheck.reason === "not-configured") {
    if (process.env.NODE_ENV === "production" || env.FERMION_API_KEY) {
      // Configured vendor without a webhook secret must not accept forgeries.
      Sentry.captureMessage("fermion webhook received without configured secret", {
        level: "warning",
        tags: { webhook: "fermion" },
      });
      return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const envelope = payload as {
    eventUniqueId?: string;
    id?: string;
    eventId?: string;
    type?: string;
    event?: string;
    eventType?: string;
    payload?: Record<string, unknown>;
    data?: Record<string, unknown>;
  };

  const eventType = String(
    envelope.payload?.eventType ?? envelope.eventType ?? envelope.event ?? envelope.type ?? "unknown",
  );
  const eventRef = String(
    envelope.eventUniqueId ??
      envelope.eventId ??
      envelope.id ??
      crypto.createHash("sha256").update(rawBody).digest("hex"),
  );
  const data = (envelope.payload ?? envelope.data ?? payload) as Record<string, unknown>;

  // Idempotency: atomic create-or-get survives concurrent deliveries of the
  // same eventUniqueId (P2002-safe, unlike find-then-create).
  const event = await db.webhookEvent.upsert({
    where: { provider_eventRef: { provider: "FERMION", eventRef } },
    update: {},
    create: {
      provider: "FERMION",
      eventRef,
      eventType,
      signatureValid: secretCheck.reason === "valid",
      payload: payload as object,
    },
  });
  if (event.status === "PROCESSED") {
    return NextResponse.json({ ok: true, deduped: true });
  }

  try {
    await processFermionEvent(eventType, data);
    await db.webhookEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", processedAt: new Date(), attempts: { increment: 1 } },
    });
  } catch (err) {
    reportWebhookProcessingError(err, eventType);
    await db.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        error: err instanceof Error ? err.message : String(err),
      },
    });
    // Acknowledge receipt; FAILED events are replayed by the reconciliation job.
  }

  return NextResponse.json({ ok: true });
}
