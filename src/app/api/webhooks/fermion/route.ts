import crypto from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";
import { db } from "@/lib/db";
import { markVideoReady } from "@/lib/fermion/video";

/**
 * Fermion webhook intake. Every event lands in WebhookEvent first (idempotent
 * on provider+eventRef), then is processed. Unknown event types are stored and
 * SKIPPED — never 500 on novelty.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let signatureValid = false;
  if (env.FERMION_WEBHOOK_SECRET) {
    const signature =
      request.headers.get("x-fermion-signature") ??
      request.headers.get("fermion-signature") ??
      "";
    const expected = crypto
      .createHmac("sha256", env.FERMION_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    signatureValid =
      signature.length > 0 &&
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!signatureValid) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventType = String(payload.event ?? payload.type ?? "unknown");
  const eventRef = String(
    payload.eventId ?? payload.id ?? crypto.createHash("sha256").update(rawBody).digest("hex"),
  );

  // Idempotency: first writer wins; replays acknowledge without reprocessing.
  const existing = await db.webhookEvent.findUnique({
    where: { provider_eventRef: { provider: "FERMION", eventRef } },
  });
  if (existing && existing.status === "PROCESSED") {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const event =
    existing ??
    (await db.webhookEvent.create({
      data: {
        provider: "FERMION",
        eventRef,
        eventType,
        signatureValid,
        payload: payload as object,
      },
    }));

  try {
    const data = (payload.data ?? payload) as Record<string, unknown>;

    if (eventType.includes("video") && String(data.status ?? "").toLowerCase().includes("ready")) {
      const videoRef = String(data.videoId ?? data.videoRef ?? "");
      if (videoRef) await markVideoReady(videoRef, data);
    } else if (eventType.includes("video") && data.videoId) {
      // processing progress / failures — reconcile status conservatively
      const status = String(data.status ?? "").toLowerCase();
      if (status.includes("fail")) {
        await db.videoAsset.updateMany({
          where: { provider: "FERMION", providerVideoRef: String(data.videoId) },
          data: { status: "FAILED" },
        });
      }
    }

    await db.webhookEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", processedAt: new Date(), attempts: { increment: 1 } },
    });
  } catch (err) {
    await db.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        error: err instanceof Error ? err.message : String(err),
      },
    });
    // Acknowledge receipt; failures are retried by the reconciliation job (M13).
  }

  return NextResponse.json({ ok: true });
}
