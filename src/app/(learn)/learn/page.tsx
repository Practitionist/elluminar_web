import { Award, ChevronRight, Flame, ScrollText, Trophy, Zap } from "lucide-react";
import Link from "next/link";

import { Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getLeaderboard } from "@/lib/community/leaderboard";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function LearnDashboardPage() {
  const session = await requireUser("/learn");
  const userId = session.user.id;

  const [
    enrollments,
    projectInstances,
    upcomingSessions,
    credentials,
    xpAgg,
    streak,
    badgeCount,
    leaderboard,
  ] = await Promise.all([
    db.enrollment.findMany({
      where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } },
      orderBy: { lastActivityAt: { sort: "desc", nulls: "last" } },
      take: 6,
      include: {
        course: { include: { tenant: { select: { displayName: true } } } },
        cohort: true,
      },
    }),
    db.projectInstance.findMany({
      where: { userId, status: { notIn: ["REFUNDED", "WITHDRAWN"] } },
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: { project: true },
    }),
    db.liveSession.findMany({
      where: {
        status: "SCHEDULED",
        scheduledStartAt: { gte: new Date() },
        OR: [
          { cohort: { enrollments: { some: { userId, status: "ACTIVE" } } } },
          { projectInstance: { userId } },
        ],
      },
      orderBy: { scheduledStartAt: "asc" },
      take: 3,
      include: { course: { select: { title: true } } },
    }),
    db.credential.findMany({
      where: { userId, revokedAt: null },
      orderBy: { issuedAt: "desc" },
      take: 4,
    }),
    db.xpEvent.aggregate({ where: { userId }, _sum: { points: true } }),
    db.userStreak.findUnique({ where: { userId } }),
    db.userBadge.count({ where: { userId } }),
    getLeaderboard(userId, 5),
  ]);

  const xp = xpAgg._sum.points ?? 0;
  const currentStreak = streak?.currentDays ?? 0;
  const bestStreak = streak?.longestDays ?? 0;
  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const nextLive = upcomingSessions[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
            Good to see you, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick up where you left off — proof is built one session at a time.
          </p>
        </div>
        <div className="flex gap-2.5">
          <StatPill icon={<Zap className="size-4" />} value={xp.toLocaleString("en-IN")} label="XP" />
          <StatPill icon={<Award className="size-4" />} value={badgeCount} label="Badges" />
          <StatPill
            icon={<ScrollText className="size-4" />}
            value={credentials.length}
            label="Credentials"
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section>
            <SectionRow title="Continue learning" href="/learn/projects" />
            {enrollments.length === 0 ? (
              <EmptyCard>
                Nothing here yet —{" "}
                <Link href="/courses" className="font-bold text-primary hover:underline">
                  find your first course
                </Link>
                .
              </EmptyCard>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {enrollments.map((e) => (
                  <Link
                    key={e.id}
                    href={`/learn/courses/${e.courseId}`}
                    className="group rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <Pill tone="primary" className="px-2 py-0.5 text-[10px]">
                        Course
                      </Pill>
                      {e.status === "COMPLETED" ? (
                        <Pill tone="success" className="px-2 py-0.5 text-[10px]">
                          completed
                        </Pill>
                      ) : null}
                    </div>
                    <div className="mt-2 line-clamp-2 text-sm font-extrabold transition-colors group-hover:text-primary">
                      {e.course.title}
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground">
                      {e.course.tenant.displayName}
                      {e.cohort ? ` · ${e.cohort.name}` : ""}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-2 rounded-full bg-success"
                          style={{ width: `${Math.round(e.progressPct)}%` }}
                        />
                      </span>
                      <span className="text-xs font-extrabold tabular-nums">
                        {Math.round(e.progressPct)}%
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {projectInstances.length > 0 ? (
            <section>
              <SectionRow title="Your projects" href="/learn/projects" />
              <div className="grid gap-4 sm:grid-cols-2">
                {projectInstances.map((pi) => (
                  <Link
                    key={pi.id}
                    href={`/learn/projects/${pi.id}`}
                    className="group rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <Pill tone="distinction" className="px-2 py-0.5 text-[10px]">
                        {pi.project.tier.toLowerCase()}
                      </Pill>
                      <Pill tone="neutral" className="px-2 py-0.5 text-[10px]">
                        {pi.status.toLowerCase().replace(/_/g, " ")}
                      </Pill>
                    </div>
                    <div className="mt-2 line-clamp-2 text-sm font-extrabold transition-colors group-hover:text-primary">
                      {pi.project.title}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {credentials.length > 0 ? (
            <section>
              <SectionRow title="Your credentials" href="/verify" />
              <div className="grid gap-3 sm:grid-cols-2">
                {credentials.map((c) => (
                  <Link
                    key={c.id}
                    href={`/verify/${c.verificationCode}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                  >
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-success-subtle text-success-subtle-foreground">
                      <Award className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold">
                        {c.title}
                      </div>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {c.verificationCode}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold">Your streak</span>
              <Flame
                className={cn(
                  "size-5",
                  currentStreak > 0 ? "text-distinction" : "text-muted-foreground/40",
                )}
              />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold">{currentStreak}</span>
              <span className="text-sm font-semibold text-muted-foreground">
                day{currentStreak === 1 ? "" : "s"}
              </span>
            </div>
            <div className="text-xs font-semibold text-muted-foreground">
              Best: {bestStreak} days
            </div>
            <div className="mt-3 flex gap-1.5">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-md text-[10px] font-extrabold",
                    i < Math.min(currentStreak, 7)
                      ? "bg-success text-success-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-extrabold">Leaderboard</span>
              <Trophy className="size-4 text-distinction" />
            </div>
            {leaderboard.top.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Earn XP by completing lessons to climb the board.
              </p>
            ) : (
              <div className="space-y-1">
                {leaderboard.top.map((row) => (
                  <div
                    key={row.rank}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2 py-1.5",
                      row.isYou && "bg-primary-subtle",
                    )}
                  >
                    <span
                      className={cn(
                        "w-5 text-sm font-extrabold",
                        row.isYou ? "text-primary-subtle-foreground" : "text-muted-foreground",
                      )}
                    >
                      #{row.rank}
                    </span>
                    <span
                      className={cn(
                        "flex-1 truncate text-sm font-bold",
                        row.isYou && "text-primary-subtle-foreground",
                      )}
                    >
                      {row.isYou ? "You" : row.name}
                    </span>
                    <span className="text-xs font-extrabold text-distinction-subtle-foreground">
                      ◆ {row.points.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
                {!leaderboard.top.some((r) => r.isYou) ? (
                  <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-dashed border-border px-2 py-1.5">
                    <span className="w-5 text-sm font-extrabold text-primary">
                      #{leaderboard.myRank}
                    </span>
                    <span className="flex-1 truncate text-sm font-bold text-primary">
                      You
                    </span>
                    <span className="text-xs font-extrabold text-distinction-subtle-foreground">
                      ◆ {leaderboard.myPoints.toLocaleString("en-IN")}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {nextLive ? (
            <div className="rounded-2xl bg-ink p-5 text-ink-foreground">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold tracking-wider text-primary uppercase">
                  Next live
                </span>
                <Pill tone="distinction" className="px-2 py-0.5 text-[10px]">
                  ● {nextLive.scheduledStartAt.toLocaleDateString("en-IN", { weekday: "short" })}
                </Pill>
              </div>
              <div className="mt-2 text-sm leading-snug font-extrabold">
                {nextLive.title}
              </div>
              {nextLive.course ? (
                <div className="mt-0.5 text-xs text-ink-muted">
                  {nextLive.course.title}
                </div>
              ) : null}
              <div className="mt-3 text-xs font-semibold text-ink-muted">
                {nextLive.scheduledStartAt.toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
              {nextLive.joinUrl ? (
                <Button
                  render={<a href={nextLive.joinUrl} target="_blank" rel="noreferrer" />}
                  size="sm"
                  className="mt-3 w-full rounded-full bg-white font-bold text-ink hover:bg-white/90"
                >
                  Join session
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5">
              <span className="text-sm font-extrabold">No live sessions</span>
              <p className="mt-1 text-xs text-muted-foreground">
                Cohort sessions show up here when scheduled.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-distinction-subtle text-distinction-subtle-foreground">
        {icon}
      </span>
      <div>
        <div className="text-base leading-none font-extrabold">{value}</div>
        <div className="mt-0.5 text-[11px] font-bold text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

function SectionRow({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-extrabold">{title}</h2>
      <Link
        href={href}
        className="inline-flex items-center gap-0.5 text-xs font-bold text-primary hover:underline"
      >
        View all <ChevronRight className="size-3.5" />
      </Link>
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
