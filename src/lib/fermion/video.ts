import "server-only";

import { db } from "@/lib/db";
import { fermionSchoolHostname, fermionFetch } from "@/lib/fermion/client";
import { signFermionJwt } from "@/lib/fermion/jwt";

/**
 * Video lifecycle against Fermion (per docs.fermion.app API reference):
 *   1. get-presigned-url-for-video-upload → VideoAsset(UPLOADING) + presigned PUT URL
 *   2. client uploads the file directly to the presigned URL
 *   3. start-processing-uploaded-video → Fermion transcodes (status PROCESSING)
 *   4. webhook "recoded-video-ready-for-playback" (or reconcile job) → READY
 *   5. playback via JWT-signed private iframe embed — DRM-protected videos can
 *      ONLY play through Fermion's embedded player (manual M3U8 has no DRM).
 */

type PresignResponse = {
  videoId: string;
  presignedUrl: string;
};

export async function createVideoUpload(input: {
  tenantId: string;
  uploadedById: string;
  filename: string;
}) {
  const presign = await fermionFetch<PresignResponse>(
    "get-presigned-url-for-video-upload",
    { rawFilename: input.filename },
  );

  const asset = await db.videoAsset.create({
    data: {
      tenantId: input.tenantId,
      uploadedById: input.uploadedById,
      provider: "FERMION",
      providerVideoRef: presign.videoId,
      title: input.filename,
      status: "UPLOADING",
    },
  });

  return { videoAssetId: asset.id, uploadUrl: presign.presignedUrl };
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

export type VideoPlayback =
  | { kind: "external"; url: string | null }
  | { kind: "fermion"; videoId: string; jwtToken: string; websiteHostname: string }
  | { kind: "pending"; status?: string };

/**
 * Playback data for one view session. The Fermion variant returns everything
 * the official SDK needs to mount a DRM-capable private embed:
 * `new FermionRecordedVideo({ videoId, websiteHostname })
 *   .getPrivateEmbedPlaybackIframeCode({ jwtToken })`.
 */
export async function getVideoPlayback(
  videoAssetId: string,
  viewerUserId: string,
): Promise<VideoPlayback> {
  const asset = await db.videoAsset.findUniqueOrThrow({ where: { id: videoAssetId } });

  if (asset.provider === "EXTERNAL") {
    // Dev/testing escape hatch: playbackMeta.url is a directly playable URL.
    const meta = (asset.playbackMeta ?? {}) as { url?: string };
    return { kind: "external", url: meta.url ?? null };
  }

  if (asset.status !== "READY" || !asset.providerVideoRef) {
    return { kind: "pending", status: asset.status };
  }

  return {
    kind: "fermion",
    videoId: asset.providerVideoRef,
    jwtToken: signFermionJwt(
      {
        type: "external-embed",
        videoId: asset.providerVideoRef,
        userId: viewerUserId,
      },
      // Official recommendation: 10h–20h validity for signed embeds.
      10 * 3600,
    ),
    websiteHostname: fermionSchoolHostname(),
  };
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

/**
 * Reconciliation probe for stuck transcodes: signed-URL issuance only succeeds
 * for videos that are actually playable, so success ⇒ READY.
 */
export async function probeVideoReady(providerVideoRef: string): Promise<boolean> {
  try {
    await fermionFetch("get-signed-url-data-for-recorded-videos", {
      videoId: providerVideoRef,
    });
    return true;
  } catch {
    return false;
  }
}
