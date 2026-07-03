import "server-only";

import { db } from "@/lib/db";

import type { Prisma } from "@/generated/prisma/client";

/** Parses `email[,name]` CSV (header row optional). Returns valid rows + rejects. */
export function parseRosterCsv(csv: string): {
  rows: Array<{ email: string; name?: string }>;
  rejects: Array<{ line: number; value: string; reason: string }>;
} {
  const rows: Array<{ email: string; name?: string }> = [];
  const rejects: Array<{ line: number; value: string; reason: string }> = [];
  const seen = new Set<string>();
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const lines = csv.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const [first, ...rest] = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    const email = first?.toLowerCase() ?? "";
    if (i === 0 && email === "email") return; // header
    if (!emailRe.test(email)) {
      rejects.push({ line: i + 1, value: line, reason: "Invalid email" });
      return;
    }
    if (seen.has(email)) {
      rejects.push({ line: i + 1, value: email, reason: "Duplicate in file" });
      return;
    }
    seen.add(email);
    rows.push({ email, name: rest[0] || undefined });
  });
  return { rows, rejects };
}

export type ImportResult = {
  invited: string[];
  alreadySeated: string[];
  rejected: Array<{ email: string; reason: string }>;
};

/**
 * Seat-capacity-safe import: locks the OrgLicense row (FOR UPDATE) so the
 * count-then-insert can't race a concurrent invite past `seats`.
 * Returns the emails that need BetterAuth invitations (created by the caller,
 * outside this transaction — email sending doesn't belong in a DB lock).
 */
export async function importRosterRows(
  licenseId: string,
  rows: Array<{ email: string; name?: string }>,
): Promise<ImportResult> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "OrgLicense" WHERE id = ${licenseId} FOR UPDATE`;

    const license = await tx.orgLicense.findUniqueOrThrow({
      where: { id: licenseId },
      include: {
        seatsAssigned: {
          where: { status: { in: ["INVITED", "ACTIVATED"] } },
          include: { user: { select: { email: true } } },
        },
      },
    });
    if (license.status !== "ACTIVE" && license.status !== "DRAFT") {
      throw new Error("License is not active.");
    }
    if (license.kind === "CREDIT_POOL") {
      throw new Error("Credit pools don't use seats — members redeem directly.");
    }

    const occupiedEmails = new Set(
      license.seatsAssigned.map((s) =>
        (s.user?.email ?? s.inviteEmail ?? "").toLowerCase(),
      ),
    );
    let used = license.seatsAssigned.length;

    const result: ImportResult = { invited: [], alreadySeated: [], rejected: [] };
    for (const row of rows) {
      if (occupiedEmails.has(row.email)) {
        result.alreadySeated.push(row.email);
        continue;
      }
      if (used >= license.seats) {
        result.rejected.push({ email: row.email, reason: "Seat capacity reached" });
        continue;
      }
      // If the user already exists (verified), seat them directly.
      const existingUser = await tx.user.findUnique({
        where: { email: row.email },
        select: { id: true, emailVerified: true },
      });
      if (existingUser?.emailVerified) {
        await tx.licenseSeat.create({
          data: {
            licenseId,
            userId: existingUser.id,
            inviteEmail: row.email,
            status: "ACTIVATED",
            activatedAt: new Date(),
          },
        });
      } else {
        await tx.licenseSeat.create({
          data: { licenseId, inviteEmail: row.email, status: "INVITED" },
        });
        result.invited.push(row.email);
      }
      occupiedEmails.add(row.email);
      used += 1;
    }
    return result;
  });
}

/**
 * Single auto-match entry point: claims any INVITED seats matching this
 * verified email across active licenses. Idempotent; safe to call from
 * sign-in hooks, invitation acceptance, and layout lazy checks.
 */
export async function activateSeatsForUser(userId: string, email: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  // Unverified emails must never claim seats (account-takeover vector).
  if (!user?.emailVerified) return 0;

  const now = new Date();
  const seats = await db.licenseSeat.findMany({
    where: {
      userId: null,
      status: "INVITED",
      inviteEmail: { equals: email, mode: "insensitive" },
      license: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } },
    },
  });
  let activated = 0;
  for (const seat of seats) {
    const updated = await db.licenseSeat.updateMany({
      where: { id: seat.id, userId: null }, // guard against a concurrent claim
      data: { userId, status: "ACTIVATED", activatedAt: now },
    });
    activated += updated.count;
  }
  return activated;
}

/** Revokes a seat and expires exactly the licensed enrollments it granted. */
export async function revokeSeatCore(tx: Prisma.TransactionClient, seatId: string) {
  const seat = await tx.licenseSeat.findUniqueOrThrow({ where: { id: seatId } });
  await tx.licenseSeat.update({
    where: { id: seatId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  if (seat.userId) {
    await tx.enrollment.updateMany({
      where: { userId: seat.userId, orgLicenseId: seat.licenseId, status: "ACTIVE" },
      data: { status: "EXPIRED", expiresAt: new Date() },
    });
  }
  return seat;
}
