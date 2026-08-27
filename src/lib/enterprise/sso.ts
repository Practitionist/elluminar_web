import { env } from "@/env";

/**
 * Everything an IdP administrator has to paste on their side, derived in one
 * place so the org settings screen, the admin console and the runbook can never
 * disagree about a URL.
 *
 * These paths are owned by BetterAuth's SSO plugin and mounted under the
 * existing `/api/auth/[...all]` catch-all — we add no routes of our own. Verified
 * against @better-auth/sso@1.6.23.
 */

const AUTH_BASE = `${env.NEXT_PUBLIC_APP_URL}/api/auth`;

/**
 * The DNS TXT record name BetterAuth looks up during domain verification.
 * Mirrors `_${tokenPrefix}-${providerId}` from the plugin, with the default
 * prefix — the leading underscore follows the RFC 8552 convention for
 * infrastructure subdomains.
 */
export function ssoDomainRecordName(providerId: string): string {
  return `_better-auth-token-${providerId}`;
}

export type SsoConnectionUrls = {
  /** SAML Assertion Consumer Service — where the IdP POSTs the assertion. */
  acsUrl: string;
  /** SAML Single Logout endpoint. */
  sloUrl: string;
  /** Our SP entity ID. Conventionally the metadata URL. */
  spEntityId: string;
  /** Machine-readable SP metadata, for IdPs that import rather than hand-enter. */
  spMetadataUrl: string;
  /** OIDC redirect/callback URI to allowlist in the IdP's app config. */
  oidcRedirectUrl: string;
};

export function ssoConnectionUrls(providerId: string): SsoConnectionUrls {
  const id = encodeURIComponent(providerId);
  return {
    acsUrl: `${AUTH_BASE}/sso/saml2/sp/acs/${id}`,
    sloUrl: `${AUTH_BASE}/sso/saml2/sp/slo/${id}`,
    spEntityId: `${AUTH_BASE}/sso/saml2/sp/metadata?providerId=${id}`,
    spMetadataUrl: `${AUTH_BASE}/sso/saml2/sp/metadata?providerId=${id}&format=xml`,
    oidcRedirectUrl: `${AUTH_BASE}/sso/callback/${id}`,
  };
}

/** Discovery fields we refuse to register without — the flow cannot work if any is absent. */
const REQUIRED_DISCOVERY_FIELDS = [
  "issuer",
  "authorization_endpoint",
  "token_endpoint",
  "jwks_uri",
] as const;

export type DiscoveryProbe =
  | { ok: true; issuer: string }
  | { ok: false; reason: string };

/**
 * Probes `{issuer}/.well-known/openid-configuration` before we persist anything.
 *
 * Registration previously accepted any URL, so a typo in the issuer produced a
 * provider row that looked healthy in the admin console and failed only when a
 * real employee tried to sign in — at which point the org admin had no way to
 * tell what was wrong. Failing here turns that into an inline form error.
 */
export async function probeOidcDiscovery(
  issuer: string,
  { timeoutMs = 5_000 }: { timeoutMs?: number } = {},
): Promise<DiscoveryProbe> {
  let url: URL;
  try {
    // `new URL` on a trailing-slash issuer would swallow a path segment, so
    // build the path explicitly rather than with the two-arg constructor.
    url = new URL(
      `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`,
    );
  } catch {
    return { ok: false, reason: "That issuer is not a valid URL." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "The issuer must be served over HTTPS." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      // This is an admin-triggered liveness probe; a cached answer would defeat it.
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: `The issuer returned ${res.status} for its discovery document.`,
      };
    }

    const doc: unknown = await res.json();
    if (!doc || typeof doc !== "object") {
      return { ok: false, reason: "The discovery document was not valid JSON." };
    }

    const record = doc as Record<string, unknown>;
    const missing = REQUIRED_DISCOVERY_FIELDS.filter(
      (f) => typeof record[f] !== "string",
    );
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `The discovery document is missing: ${missing.join(", ")}.`,
      };
    }

    return { ok: true, issuer: record.issuer as string };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      reason: aborted
        ? "The issuer did not respond within 5 seconds."
        : "Could not reach the issuer's discovery endpoint.",
    };
  } finally {
    clearTimeout(timer);
  }
}
