import type { Metadata } from "next";
import { Award, BadgeCheck, Flame, Zap } from "lucide-react";
import Link from "next/link";

import { Pill } from "@/components/shared";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Portfolio",
  robots: { index: false },
};

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "•"
  );
}

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await db.portfolioProfile.findUnique({
    where: { slug },
    include: { user: { select: { id: true, name: true } } },
  });

  if (!profile || profile.visibility === "PRIVATE") {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          Portfolio not found
        </h1>
        <p className="mt-3 text-muted-foreground">
          This portfolio is private or doesn&apos;t exist.
        </p>
        <Link
          href="/verify"
          className="mt-6 inline-block font-bold text-primary hover:underline"
        >
          Verify a credential instead →
        </Link>
      </div>
    );
  }

  const uid = profile.user.id;
  const [credentials, badges, xpAgg, streak] = await Promise.all([
    db.credential.findMany({
      where: { userId: uid, revokedAt: null },
      orderBy: { issuedAt: "desc" },
    }),
    db.userBadge.findMany({
      where: { userId: uid },
      include: { badge: true },
      orderBy: { awardedAt: "desc" },
    }),
    db.xpEvent.aggregate({ where: { userId: uid }, _sum: { points: true } }),
    db.userStreak.findUnique({ where: { userId: uid } }),
  ]);
  const xp = xpAgg._sum.points ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* header */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="gradient-primary h-24" />
        <div className="px-6 pb-6 sm:px-8">
          <div className="-mt-10 flex items-end gap-4">
            <span className="inline-flex size-20 items-center justify-center rounded-2xl border-4 border-card bg-primary-subtle text-2xl font-extrabold text-primary-subtle-foreground">
              {initialsOf(profile.user.name ?? "•")}
            </span>
            <Pill tone="success" className="mb-2">
              <BadgeCheck className="size-3.5" /> Verified portfolio
            </Pill>
          </div>
          <h1 className="mt-4 font-display text-3xl font-medium tracking-tight">
            {profile.user.name}
          </h1>
          {profile.headline ? (
            <p className="mt-1 text-muted-foreground">{profile.headline}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill tone="distinction">
              <Zap className="size-3.5" /> {xp.toLocaleString("en-IN")} XP
            </Pill>
            <Pill tone="primary">
              <Award className="size-3.5" /> {credentials.length} credentials
            </Pill>
            <Pill tone="neutral">🏅 {badges.length} badges</Pill>
            {streak && streak.longestDays > 0 ? (
              <Pill tone="neutral">
                <Flame className="size-3.5" /> {streak.longestDays}-day best streak
              </Pill>
            ) : null}
          </div>
        </div>
      </div>

      {/* credentials */}
      <h2 className="mt-10 font-display text-2xl font-medium tracking-tight">
        Verified credentials
      </h2>
      {credentials.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No public credentials yet.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {credentials.map((c) => (
            <Link
              key={c.id}
              href={`/verify/${c.verificationCode}`}
              className="group rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <Pill tone="success">
                  <BadgeCheck className="size-3.5" /> Verified
                </Pill>
                {c.grade ? <Pill tone="distinction">★ {c.grade}</Pill> : null}
              </div>
              <div className="mt-3 font-extrabold transition-colors group-hover:text-primary">
                {c.title}
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {c.verificationCode} · {c.kind.toLowerCase()}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* badges */}
      {badges.length > 0 ? (
        <>
          <h2 className="mt-10 font-display text-2xl font-medium tracking-tight">
            Badges
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {badges.map((ub) => (
              <div
                key={ub.id}
                className="flex flex-col items-center rounded-2xl border border-distinction/30 bg-distinction-subtle p-3 text-center"
                title={ub.badge.description}
              >
                <span className="text-2xl">{ub.badge.icon ?? "🏅"}</span>
                <span className="mt-1 text-[11px] font-extrabold text-distinction-subtle-foreground">
                  {ub.badge.name}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <p className="mt-10 text-center text-xs font-semibold text-muted-foreground">
        Every credential here is independently verifiable — click any to check
        it against the registry.
      </p>
    </div>
  );
}
