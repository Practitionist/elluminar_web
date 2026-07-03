import "server-only";

import { db } from "@/lib/db";
import { fermionFetch } from "@/lib/fermion/client";

/**
 * Fermion user-identity mapping. Embedded labs and live classrooms need a
 * Fermion-side user; we mint one lazily and remember it in UserProviderIdentity.
 */
export async function ensureFermionUser(userId: string): Promise<string> {
  const existing = await db.userProviderIdentity.findUnique({
    where: { provider_userId: { provider: "FERMION", userId } },
  });
  if (existing) return existing.externalRef;

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const created = await fermionFetch<{ userId: string }>("create-new-user", {
    name: user.name,
    email: user.email,
  });

  await db.userProviderIdentity.create({
    data: { provider: "FERMION", userId, externalRef: created.userId },
  });
  return created.userId;
}

/** Short-lived SSO link so an embedded Fermion surface is signed in as this user. */
export async function getFermionLoginLink(userId: string) {
  const fermionUserId = await ensureFermionUser(userId);
  return fermionFetch<{ loginLink: string }>("get-login-link-for-user", {
    userId: fermionUserId,
  });
}
