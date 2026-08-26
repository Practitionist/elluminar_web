import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/env";
import { db } from "@/lib/db";

/**
 * Supabase Storage for non-video files (images, documents, submissions,
 * certificate PDFs). Buckets: public-assets (public read), uploads,
 * submissions, certificates (private, signed URLs).
 */

export const STORAGE_BUCKETS = {
  publicAssets: "public-assets",
  uploads: "uploads",
  submissions: "submissions",
  certificates: "certificates",
} as const;

export function isStorageConfigured() {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function storageClient() {
  if (!isStorageConfigured()) {
    throw new Error(
      "Supabase Storage is not configured (set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** Creates a MediaAsset row + a signed upload URL the browser PUTs to directly. */
export async function createMediaUpload(input: {
  tenantId?: string;
  uploadedById: string;
  bucket: (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
  filename: string;
  mime: string;
  sizeBytes: number;
  kind: "IMAGE" | "DOCUMENT" | "VIDEO_SOURCE" | "ARCHIVE" | "CERT_PDF" | "OTHER";
}) {
  const asset = await db.mediaAsset.create({
    data: {
      tenantId: input.tenantId,
      uploadedById: input.uploadedById,
      storage: "SUPABASE",
      bucket: input.bucket,
      filename: input.filename,
      mime: input.mime,
      sizeBytes: BigInt(input.sizeBytes),
      kind: input.kind,
      status: "UPLOADING",
    },
  });
  const path = `${input.tenantId ?? "user"}/${asset.id}/${input.filename}`;

  const { data, error } = await storageClient()
    .storage.from(input.bucket)
    .createSignedUploadUrl(path);
  if (error) {
    Sentry.captureException(error, { tags: { vendor: "supabase-storage" } });
    throw new Error(`Storage presign failed: ${error.message}`);
  }

  await db.mediaAsset.update({ where: { id: asset.id }, data: { path } });
  return { assetId: asset.id, path, uploadUrl: data.signedUrl, token: data.token };
}

export async function finalizeMediaUpload(assetId: string) {
  return db.mediaAsset.update({
    where: { id: assetId },
    data: { status: "READY" },
  });
}

/**
 * Confirms the object actually landed in storage before an asset is marked
 * READY — a client that skips the PUT must not produce a gradeable asset.
 */
export async function objectExists(bucket: string, path: string): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const folder = slash > 0 ? path.slice(0, slash) : "";
  const filename = slash > 0 ? path.slice(slash + 1) : path;
  const { data, error } = await storageClient()
    .storage.from(bucket)
    .list(folder, { search: filename, limit: 1 });
  if (error) {
    Sentry.captureException(error, { tags: { vendor: "supabase-storage" } });
    return false;
  }
  return data.some((o) => o.name === filename);
}

/** Signed read URL for private buckets (submissions, certificates). */
export async function getSignedReadUrl(assetId: string, expiresInSeconds = 60 * 10) {
  const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
  if (!asset.bucket || !asset.path) throw new Error("Asset has no storage path");

  if (asset.bucket === STORAGE_BUCKETS.publicAssets) {
    const { data } = storageClient().storage.from(asset.bucket).getPublicUrl(asset.path);
    return data.publicUrl;
  }
  const { data, error } = await storageClient()
    .storage.from(asset.bucket)
    .createSignedUrl(asset.path, expiresInSeconds);
  if (error) {
    Sentry.captureException(error, { tags: { vendor: "supabase-storage" } });
    throw new Error(`Signed URL failed: ${error.message}`);
  }
  return data.signedUrl;
}

/** Server-side upload (generated PDFs: certificates, invoices, statements). */
export async function uploadBufferAsAsset(input: {
  tenantId?: string;
  bucket: (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
  filename: string;
  mime: string;
  buffer: Buffer | Uint8Array;
  kind: "CERT_PDF" | "DOCUMENT" | "OTHER";
}) {
  const asset = await db.mediaAsset.create({
    data: {
      tenantId: input.tenantId,
      storage: "SUPABASE",
      bucket: input.bucket,
      filename: input.filename,
      mime: input.mime,
      sizeBytes: BigInt(input.buffer.byteLength),
      kind: input.kind,
      status: "UPLOADING",
    },
  });
  const path = `${input.tenantId ?? "platform"}/${asset.id}/${input.filename}`;
  const { error } = await storageClient()
    .storage.from(input.bucket)
    .upload(path, input.buffer, { contentType: input.mime, upsert: true });
  if (error) {
    Sentry.captureException(error, { tags: { vendor: "supabase-storage" } });
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return db.mediaAsset.update({
    where: { id: asset.id },
    data: { path, status: "READY" },
  });
}
