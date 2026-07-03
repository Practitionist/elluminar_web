import "server-only";

import { db } from "@/lib/db";
import { fermionFetch } from "@/lib/fermion/client";

/**
 * Video lifecycle against Fermion:
 *   1. createVideoUpload → VideoAsset(UPLOAD_PENDING) + presigned PUT URL
 *   2. client uploads the file directly to the presigned URL
 *   3. markUploadedAndProcess → Fermion transcodes (status PROCESSING)
 *   4. webhook (or pollVideoStatus fallback) → READY with playbackMeta
 *   5. getVideoPlayback → short-lived signed playback data for the player
 */

type PresignResponse = {
  videoId: string;
  presignedUploadUrl: string;
};

export async function createVideoUpload(input: {
  tenantId: string;
  uploadedById: string;
  title: string;
}) {
  const presign = await fermionFetch<PresignResponse>(
    "get-presigned-url-to-upload-video",
    { title: input.title },
  );

  const asset = await db.videoAsset.create({
    data: {
      tenantId: input.tenantId,
      uploadedById: input.uploadedById,
      provider: "FERMION",
      providerVideoRef: presign.videoId,
      title: input.title,
      status: "UPLOADING",
    },
  });

  return { videoAssetId: asset.id, uploadUrl: presign.presignedUploadUrl };
}

export async function markUploadedAndProcess(videoAssetId: string) {
  const asset = await db.videoAsset.findUniqueOrThrow({ where: { id: videoAssetId } });
  if (!asset.providerVideoRef) throw new Error("Video has no provider reference");

  await fermionFetch("start-processing-uploaded-video", {
    videoId: asset.providerVideoRef,
  });

  return db.videoAsset.update({
    where: { id: videoAssetId },
    data: { status: "PROCESSING" },
  });
}

type SignedPlaybackResponse = {
  m3u8Url?: string;
  playbackUrl?: string;
  drm?: unknown;
  [key: string]: unknown;
};

/** Short-lived signed playback data — call per view session, never cache long. */
export async function getVideoPlayback(videoAssetId: string) {
  const asset = await db.videoAsset.findUniqueOrThrow({ where: { id: videoAssetId } });

  if (asset.provider === "EXTERNAL") {
    // Dev/testing escape hatch: playbackMeta.url is a directly playable URL.
    const meta = (asset.playbackMeta ?? {}) as { url?: string };
    return { kind: "external" as const, url: meta.url ?? null };
  }

  if (asset.status !== "READY") {
    return { kind: "pending" as const, status: asset.status };
  }
  const data = await fermionFetch<SignedPlaybackResponse>(
    "get-signed-url-data-for-recorded-videos",
    { videoId: asset.providerVideoRef },
  );
  return { kind: "fermion" as const, data };
}

/** Fallback when webhooks are not configured: reconcile processing status. */
export async function markVideoReady(providerVideoRef: string, playbackMeta?: unknown) {
  return db.videoAsset.updateMany({
    where: { provider: "FERMION", providerVideoRef },
    data: {
      status: "READY",
      playbackMeta: (playbackMeta as object) ?? undefined,
    },
  });
}
