import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const client = {
    mediaAsset: { findUnique: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  };
  // Interactive transactions run against the same mock client, so tx.* calls
  // land on the spies above and a throwing callback propagates like a rollback.
  client.$transaction.mockImplementation((fn: (tx: typeof client) => unknown) => fn(client));
  return client;
});

const remove = vi.hoisted(() => vi.fn());
const sentry = vi.hoisted(() => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
const env = vi.hoisted(() => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  } as Record<string, string | undefined>,
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/env", () => env);
vi.mock("@sentry/nextjs", () => sentry);
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ storage: { from: () => ({ remove }) } }),
}));

import { Prisma } from "@/generated/prisma/client";
import { deleteMediaAssetIfUnreferenced } from "@/lib/storage";

const noRefs = { lessonResources: 0, submissionFiles: 0, digitalProducts: 0, credentials: 0 };

const asset = (counts: Partial<typeof noRefs> = {}) => ({
  bucket: "uploads",
  path: "tenant/asset1/file.pdf",
  _count: { ...noRefs, ...counts },
});

describe("deleteMediaAssetIfUnreferenced", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remove.mockResolvedValue({ error: null });
  });

  it("deletes the row BEFORE removing the stored object", async () => {
    db.mediaAsset.findUnique.mockResolvedValueOnce(asset());
    db.mediaAsset.delete.mockResolvedValueOnce({});

    await expect(deleteMediaAssetIfUnreferenced("asset1")).resolves.toBe(true);

    // Ordering is the point: removing storage first would, on a failed delete,
    // leave a surviving MediaAsset pointing at an object that no longer exists.
    expect(db.mediaAsset.delete.mock.invocationCallOrder[0]).toBeLessThan(
      remove.mock.invocationCallOrder[0],
    );
    expect(remove).toHaveBeenCalledWith(["tenant/asset1/file.pdf"]);
  });

  it("keeps the asset when another row still references it", async () => {
    db.mediaAsset.findUnique.mockResolvedValueOnce(asset({ submissionFiles: 1 }));

    await expect(deleteMediaAssetIfUnreferenced("asset1")).resolves.toBe(false);
    expect(db.mediaAsset.delete).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("counts every relation, not just lesson resources", async () => {
    for (const key of ["lessonResources", "digitalProducts", "credentials"] as const) {
      vi.clearAllMocks();
      db.mediaAsset.findUnique.mockResolvedValueOnce(asset({ [key]: 1 }));
      await expect(deleteMediaAssetIfUnreferenced("asset1")).resolves.toBe(false);
      expect(remove).not.toHaveBeenCalled();
    }
  });

  it("leaves the object alone when a concurrent attach wins the FK race", async () => {
    db.mediaAsset.findUnique.mockResolvedValueOnce(asset());
    db.mediaAsset.delete.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("FK constraint failed", {
        code: "P2003",
        clientVersion: "7.8.0",
        meta: {},
      }),
    );

    await expect(deleteMediaAssetIfUnreferenced("asset1")).resolves.toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it("rethrows unrelated database errors instead of swallowing them", async () => {
    db.mediaAsset.findUnique.mockResolvedValueOnce(asset());
    db.mediaAsset.delete.mockRejectedValueOnce(new Error("connection reset"));

    await expect(deleteMediaAssetIfUnreferenced("asset1")).rejects.toThrow("connection reset");
    expect(remove).not.toHaveBeenCalled();
  });

  it("reports a missing asset as nothing-removed", async () => {
    db.mediaAsset.findUnique.mockResolvedValueOnce(null);
    await expect(deleteMediaAssetIfUnreferenced("gone")).resolves.toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it("still reports success when storage removal fails (row is already gone)", async () => {
    db.mediaAsset.findUnique.mockResolvedValueOnce(asset());
    db.mediaAsset.delete.mockResolvedValueOnce({});
    remove.mockResolvedValueOnce({ error: { message: "object locked" } });

    await expect(deleteMediaAssetIfUnreferenced("asset1")).resolves.toBe(true);
    expect(sentry.captureException).toHaveBeenCalled();
  });
});
