import "server-only";

import * as Sentry from "@sentry/nextjs";

import { env } from "@/env";

/**
 * Fermion public API client — the ONLY place Fermion HTTP details live.
 * Everything upstream works with our VideoAsset/LiveSession/SandboxSession rows.
 *
 * API shape (verified against docs.fermion.app, July 2026):
 *   POST {base}/{kebab-endpoint}
 *   Header: FERMION-API-KEY
 *   Request envelope:  { data: [{ data: <payload> }] }
 *   Response envelope: [{ output: { status: "ok"|"error", data?, errorMessage? } }]
 *   Rate limit: 60 requests/minute.
 */

const DEFAULT_BASE_URL = "https://backend.codedamn.com/api/public";

export class FermionError extends Error {
  constructor(
    message: string,
    readonly endpoint?: string,
  ) {
    super(message);
    this.name = "FermionError";
  }
}

export class FermionNotConfiguredError extends FermionError {
  constructor() {
    super(
      "Fermion is not configured (set FERMION_API_KEY). Video, live-class, and code-lab features are unavailable.",
    );
    this.name = "FermionNotConfiguredError";
  }
}

export const isFermionConfigured = () => Boolean(env.FERMION_API_KEY);

/**
 * School hostname (e.g. "acme.fermion.app") used to build whitelabel embed
 * URLs for recorded videos, coding labs, and live sessions.
 */
export function fermionSchoolHostname(): string {
  const host = env.FERMION_SCHOOL_HOSTNAME;
  if (!host) {
    throw new FermionNotConfiguredError();
  }
  return host.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

type FermionOutput<T> = {
  output:
    | { status: "ok"; data: T }
    | { status: "error"; errorMessage: string };
};

export async function fermionFetch<T>(
  endpoint: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!env.FERMION_API_KEY) throw new FermionNotConfiguredError();

  try {
    const base = env.FERMION_API_BASE_URL ?? DEFAULT_BASE_URL;
    const res = await fetch(`${base}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "FERMION-API-KEY": env.FERMION_API_KEY,
      },
      body: JSON.stringify({ data: [{ data: payload }] }),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new FermionError(
        `Fermion ${endpoint} failed with HTTP ${res.status}`,
        endpoint,
      );
    }

    const body = (await res.json()) as FermionOutput<T>[];
    const output = body?.[0]?.output;
    if (!output) throw new FermionError(`Fermion ${endpoint}: empty response`, endpoint);
    if (output.status === "error") {
      throw new FermionError(`Fermion ${endpoint}: ${output.errorMessage}`, endpoint);
    }
    return output.data;
  } catch (err) {
    if (err instanceof FermionError && !(err instanceof FermionNotConfiguredError)) {
      Sentry.captureException(err, { tags: { vendor: "fermion", endpoint } });
    }
    throw err;
  }
}

/** Connectivity check for admin diagnostics. */
export async function fermionHealthcheck() {
  return fermionFetch<{ message: string }>("test", { message: "ping" });
}
