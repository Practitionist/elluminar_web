import "server-only";

import crypto from "node:crypto";

import { env } from "@/env";

import { FermionNotConfiguredError } from "@/lib/fermion/client";

/**
 * Minimal HS256 JWT signer for Fermion embed tokens.
 *
 * Fermion's embed surfaces (recorded video, interactive labs, IO labs) are
 * authorized by a JWT signed with the school's FERMION_API_KEY:
 *   - recorded video: { type: "external-embed", videoId, userId } (~10h TTL)
 *   - labs:           { labId, userId } (1h TTL)
 * See docs.fermion.app → "Embed Recorded Videos" / "Embed an Interactive Lab".
 */
export function signFermionJwt(
  claims: Record<string, unknown>,
  expiresInSeconds = 3600,
): string {
  if (!env.FERMION_API_KEY) throw new FermionNotConfiguredError();

  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = encode({ alg: "HS256", typ: "JWT" });
  const body = encode({ iat: now, exp: now + expiresInSeconds, ...claims });
  const signature = crypto
    .createHmac("sha256", env.FERMION_API_KEY)
    .update(`${head}.${body}`)
    .digest("base64url");
  return `${head}.${body}.${signature}`;
}
