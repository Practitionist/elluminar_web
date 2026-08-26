import crypto from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  videoAsset: {
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  sandboxSession: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  userProviderIdentity: { findUnique: vi.fn() },
  notification: { create: vi.fn() },
  webhookEvent: { findMany: vi.fn(), update: vi.fn() },
}));

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

const env = vi.hoisted(() => ({
  env: {
    FERMION_API_KEY: "test-api-key",
    FERMION_API_BASE_URL: undefined,
    FERMION_WEBHOOK_SECRET: "whsec-test",
    FERMION_SCHOOL_HOSTNAME: "elluminar.fermion.app",
  } as Record<string, string | undefined>,
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@sentry/nextjs", () => sentry);
vi.mock("@/env", () => env);
vi.mock("@/lib/fermion/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fermion/client")>();
  return { ...actual, fermionFetch: vi.fn() };
});

import { fermionFetch } from "@/lib/fermion/client";
import { signFermionJwt } from "@/lib/fermion/jwt";
import { buildLabEmbedUrl } from "@/lib/fermion/labs";
import {
  reconcileStuckFermionVideos,
  retryFailedFermionWebhooks,
} from "@/lib/fermion/reconcile";
import { checkWebhookSecret, processFermionEvent } from "@/lib/fermion/webhook-handlers";

const fetchMock = vi.mocked(fermionFetch);

function decodeSegment(segment: string) {
  return JSON.parse(Buffer.from(segment, "base64url").toString()) as Record<
    string,
    unknown
  >;
}

describe("signFermionJwt", () => {
  it("produces a verifiable HS256 token with claims and expiry", () => {
    const before = Math.floor(Date.now() / 1000);
    const token = signFermionJwt({ labId: "lab1", userId: "user1" }, 60);

    const [head, body, sig] = token.split(".");
    expect(head && body && sig).toBeTruthy();

    expect(decodeSegment(head)).toMatchObject({ alg: "HS256", typ: "JWT" });
    const payload = decodeSegment(body);
    expect(payload.labId).toBe("lab1");
    expect(payload.userId).toBe("user1");
    expect((payload.exp as number) - (payload.iat as number)).toBe(60);
    expect(payload.iat).toBeGreaterThanOrEqual(before);

    const expectedSig = crypto
      .createHmac("sha256", "test-api-key")
      .update(`${head}.${body}`)
      .digest("base64url");
    expect(sig).toBe(expectedSig);
  });
});

describe("buildLabEmbedUrl", () => {
  it("builds the official interactive-lab embed URL with signed claims", () => {
    const url = buildLabEmbedUrl({ labId: "lab42", userId: "user7" });
    expect(url).toMatch(/^https:\/\/elluminar\.fermion\.app\/embed\/lab\?token=/);

    const token = new URL(url).searchParams.get("token") ?? "";
    const payload = decodeSegment(token.split(".")[1]);
    expect(payload).toMatchObject({ labId: "lab42", userId: "user7" });
  });

  it("routes IO labs to the io-coding-lab embed path", () => {
    const url = buildLabEmbedUrl({
      labId: "io1",
      userId: "user7",
      kind: "IO_LAB",
    });
    expect(url).toContain("/embed/io-coding-lab?token=");
  });
});

describe("processFermionEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks videos READY on recoded-video-ready-for-playback", async () => {
    db.videoAsset.updateMany.mockResolvedValueOnce({ count: 1 });

    await processFermionEvent("recoded-video-ready-for-playback", {
      eventType: "recoded-video-ready-for-playback",
      videoId: "vid-123",
    });

    expect(db.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { provider: "FERMION", providerVideoRef: "vid-123" },
      data: expect.objectContaining({ status: "READY" }),
    });
  });

  it("stores lab-run-test results on the learner's latest session", async () => {
    db.user.findUnique.mockResolvedValueOnce({ id: "our-user" });
    db.sandboxSession.findFirst.mockResolvedValueOnce({
      id: "sess1",
      startedAt: new Date(Date.now() - 120_000),
      metadata: {},
    });
    db.sandboxSession.update.mockResolvedValueOnce({ id: "sess1" });

    await processFermionEvent("lab-run-tests", {
      eventType: "lab-run-tests",
      apiUserId: "our-user",
      internalUserId: "f-internal",
      labId: "lab9",
      challengeResult: {
        isLabAttempted: true,
        result: [
          { challengeId: "c1", isChallengePassed: true, challengeLabel: "one" },
          { challengeId: "c2", isChallengePassed: false, challengeLabel: "two" },
        ],
      },
    });

    const call = db.sandboxSession.update.mock.calls[0][0];
    expect(call.where.id).toBe("sess1");
    expect(call.data.metadata.totalChallengesCount).toBe(2);
    expect(call.data.metadata.passedChallengesCount).toBe(1);
    expect(call.data.durationSec).toBeGreaterThanOrEqual(120);
  });

  it("drops unattributable lab events instead of guessing a user", async () => {
    db.user.findUnique.mockResolvedValueOnce(null);
    db.userProviderIdentity.findUnique.mockResolvedValueOnce(null);

    await processFermionEvent("lab-run-tests", {
      eventType: "lab-run-tests",
      internalUserId: "unknown",
      labId: "lab9",
      challengeResult: { isLabAttempted: false },
    });

    expect(db.sandboxSession.findFirst).not.toHaveBeenCalled();
    expect(db.sandboxSession.update).not.toHaveBeenCalled();
    expect(db.sandboxSession.create).not.toHaveBeenCalled();
  });

  it("ignores unrelated event types without side effects", async () => {
    await processFermionEvent("paid-digital-product-sale", { userId: "x" });
    expect(db.videoAsset.updateMany).not.toHaveBeenCalled();
  });

  it("flips videos to FAILED on video-ish events with a failure status", async () => {
    await processFermionEvent("vendor-video-status-update", {
      videoId: "vx",
      status: "FAILED",
    });

    expect(db.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { provider: "FERMION", providerVideoRef: "vx" },
      data: { status: "FAILED" },
    });
  });
});

describe("checkWebhookSecret", () => {
  const original = env.env.FERMION_WEBHOOK_SECRET;

  afterEach(() => {
    env.env.FERMION_WEBHOOK_SECRET = original;
  });

  it("accepts the exact shared secret (constant-time path)", () => {
    expect(checkWebhookSecret("whsec-test")).toEqual({ ok: true, reason: "valid" });
  });

  it("rejects wrong or missing secrets", () => {
    expect(checkWebhookSecret("wrong-value")).toEqual({ ok: false, reason: "invalid" });
    expect(checkWebhookSecret(null)).toEqual({ ok: false, reason: "invalid" });
    expect(checkWebhookSecret("")).toEqual({ ok: false, reason: "invalid" });
  });

  it("reports not-configured when no secret is set", () => {
    env.env.FERMION_WEBHOOK_SECRET = undefined;
    expect(checkWebhookSecret("anything")).toEqual({
      ok: false,
      reason: "not-configured",
    });
  });
});

describe("reconcileStuckFermionVideos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("readies playable assets, fails 72h-stale ones, notifies uploaders", async () => {
    const now = new Date();
    db.videoAsset.findMany.mockResolvedValueOnce([
      {
        id: "a1",
        providerVideoRef: "v1",
        title: "Intro",
        uploadedById: null,
        updatedAt: new Date(now.getTime() - 25 * 3600_000),
        tenant: { slug: "acme" },
      },
      {
        id: "a2",
        providerVideoRef: "v2",
        title: "Broken",
        uploadedById: "creator-1",
        updatedAt: new Date(now.getTime() - 80 * 3600_000),
        tenant: { slug: "acme" },
      },
    ]);
    fetchMock.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(
      new Error("not ready"),
    );
    db.notification.create.mockResolvedValueOnce({ id: "n1" });

    const results = await reconcileStuckFermionVideos(now);

    expect(results).toEqual({ probed: 2, readied: 1, failed: 1 });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "get-signed-url-data-for-recorded-videos",
      { videoId: "v1" },
    );
    expect(db.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { provider: "FERMION", providerVideoRef: "v2" },
      data: { status: "FAILED" },
    });
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "creator-1", category: "system" }),
    });
    expect(sentry.captureMessage).toHaveBeenCalled();
  });
});

describe("retryFailedFermionWebhooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("replays failed events through the shared processor", async () => {
    db.webhookEvent.findMany.mockResolvedValueOnce([
      {
        id: "w1",
        eventType: "recoded-video-ready-for-playback",
        payload: {
          eventUniqueId: "evt-1",
          payload: {
            eventType: "recoded-video-ready-for-playback",
            videoId: "v-replay",
          },
        },
      },
    ]);
    db.videoAsset.updateMany.mockResolvedValue({ count: 1 });
    db.webhookEvent.update.mockResolvedValue({ id: "w1" });

    const results = await retryFailedFermionWebhooks();

    expect(results).toEqual({ retried: 1, recovered: 1 });
    expect(db.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: "w1" },
      data: expect.objectContaining({ status: "PROCESSED" }),
    });
  });
});
