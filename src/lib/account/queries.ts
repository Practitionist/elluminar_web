import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * Account data-access layer. Everything here returns a DTO — never a raw
 * Prisma row — so a client component can only ever receive the fields it
 * needs. `User` in particular carries `role`, `banReason` and `anonymizedAt`,
 * none of which belong in a props object.
 */

/** Mirrors the gate in lib/auth/session.ts; never true in production. */
const DEV_AUTH_BYPASS =
  process.env.NODE_ENV !== "production" && process.env.DEV_DISABLE_AUTH === "true";

function isUnauthorized(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { statusCode?: number }).statusCode === 401
  );
}

export type AccountProfile = {
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  phone: string | null;
  timezone: string;
  locale: string;
  marketingOptIn: boolean;
  twoFactorEnabled: boolean;
  /** Null until onboarding is finished; drives the wizard gate. */
  onboardedAt: Date | null;
  createdAt: Date;
};

export const getAccountProfile = cache(async (): Promise<AccountProfile> => {
  const session = await requireUser("/account");
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      phone: true,
      timezone: true,
      locale: true,
      marketingOptIn: true,
      twoFactorEnabled: true,
      onboardedAt: true,
      createdAt: true,
    },
  });
  return { ...user, twoFactorEnabled: user.twoFactorEnabled ?? false };
});

export type LinkedAccount = {
  id: string;
  provider: string;
  createdAt: Date;
};

/**
 * Which sign-in methods exist for this user. `credential` is the
 * email-and-password one; its absence means the account is SSO/social-only and
 * "change password" should read "set a password" instead.
 */
export const getLinkedAccounts = cache(async (): Promise<LinkedAccount[]> => {
  const session = await requireUser("/account");
  const accounts = await db.account.findMany({
    where: { userId: session.user.id },
    select: { id: true, providerId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return accounts.map((a) => ({
    id: a.id,
    provider: a.providerId,
    createdAt: a.createdAt,
  }));
});

export type AccountSession = {
  id: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
};

/**
 * Active sessions, current one first. `token` is what BetterAuth's
 * revoke-session endpoint takes as its identifier — it is the caller's own
 * session token, already in their cookie, so returning it to them grants
 * nothing they did not already have.
 */
export async function getAccountSessions(): Promise<AccountSession[]> {
  const requestHeaders = await headers();

  // Unlike everything else here, this reads BetterAuth's own session store
  // rather than ours — so it needs a real session cookie, which the
  // DEV_DISABLE_AUTH bypass in lib/auth/session.ts does not produce. Without
  // this the page 500s in local dev for a reason that has nothing to do with
  // the page.
  const [sessions, current] = await Promise.all([
    auth.api.listSessions({ headers: requestHeaders }).catch((err: unknown) => {
      if (DEV_AUTH_BYPASS && isUnauthorized(err)) return [];
      throw err;
    }),
    auth.api.getSession({ headers: requestHeaders }).catch(() => null),
  ]);

  const currentToken = current?.session.token;

  return sessions
    .map((s) => ({
      id: s.id,
      token: s.token,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      expiresAt: s.expiresAt,
      ipAddress: s.ipAddress ?? null,
      userAgent: s.userAgent ?? null,
      isCurrent: s.token === currentToken,
    }))
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
}

/**
 * Best-effort device label from a user-agent string. Deliberately coarse —
 * the point is "is this me?", and a precise version number invites a false
 * sense of forensic accuracy from a header the client fully controls.
 */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser =
    /Edg\//.test(userAgent) ? "Edge"
    : /OPR\/|Opera/.test(userAgent) ? "Opera"
    : /Chrome\//.test(userAgent) ? "Chrome"
    : /Safari\//.test(userAgent) ? "Safari"
    : /Firefox\//.test(userAgent) ? "Firefox"
    : "Browser";

  const os =
    /iPhone|iPad|iPod/.test(userAgent) ? "iOS"
    : /Android/.test(userAgent) ? "Android"
    : /Mac OS X/.test(userAgent) ? "macOS"
    : /Windows/.test(userAgent) ? "Windows"
    : /Linux/.test(userAgent) ? "Linux"
    : "Unknown OS";

  return `${browser} on ${os}`;
}
