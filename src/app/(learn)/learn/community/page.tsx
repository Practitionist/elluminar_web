import { Flame, Trophy } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { requireUser } from "@/lib/auth/session";
import { getLeaderboard } from "@/lib/community/leaderboard";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Community" };

const RANK_ACCENT: Record<number, string> = {
  1: "bg-distinction-subtle text-distinction-subtle-foreground",
  2: "bg-muted text-foreground",
  3: "bg-primary-subtle text-primary-subtle-foreground",
};

export default async function CommunityPage() {
  const session = await requireUser("/learn/community");
  const userId = session.user.id;

  const [board, streak, myBadgeCount, allBadges, myBadges] = await Promise.all([
    getLeaderboard(userId, 20),
    db.userStreak.findUnique({ where: { userId } }),
    db.userBadge.count({ where: { userId } }),
    db.badge.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.userBadge.findMany({
      where: { userId },
      select: { badgeId: true },
    }),
  ]);

  const earned = new Set(myBadges.map((b) => b.badgeId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Community
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Effort compounds. Keep your streak alive and climb the board.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="gauge" label="Your rank" value={`#${board.myRank}`} tone="primary" />
        <StatCard icon="community" label="Total XP" value={board.myPoints.toLocaleString("en-IN")} tone="distinction" hint="all time" />
        <StatCard icon="community" label="Current streak" value={`${streak?.currentDays ?? 0}d`} tone="success" hint={`best ${streak?.longestDays ?? 0}`} />
        <StatCard icon="community" label="Badges" value={myBadgeCount} tone="info" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* leaderboard */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-base font-extrabold">Leaderboard</span>
            <Trophy className="size-4 text-distinction" />
          </div>
          {board.top.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No XP yet — complete a lesson to get on the board.
            </p>
          ) : (
            <div className="space-y-1">
              {board.top.map((row) => (
                <div
                  key={row.rank}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5",
                    row.isYou && "bg-primary-subtle",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                      RANK_ACCENT[row.rank] ?? "text-muted-foreground",
                    )}
                  >
                    {row.rank}
                  </span>
                  <span
                    className={cn(
                      "flex-1 truncate text-sm font-bold",
                      row.isYou && "text-primary-subtle-foreground",
                    )}
                  >
                    {row.isYou ? "You" : row.name}
                  </span>
                  <span className="text-sm font-extrabold text-distinction-subtle-foreground">
                    ◆ {row.points.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
              {!board.top.some((r) => r.isYou) ? (
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2.5">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-primary">
                    {board.myRank}
                  </span>
                  <span className="flex-1 truncate text-sm font-bold text-primary">
                    You
                  </span>
                  <span className="text-sm font-extrabold text-distinction-subtle-foreground">
                    ◆ {board.myPoints.toLocaleString("en-IN")}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* badges */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-base font-extrabold">Badges</span>
            <span className="text-xs font-bold text-muted-foreground">
              {earned.size}/{allBadges.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {allBadges.map((b) => {
              const has = earned.has(b.id);
              return (
                <div
                  key={b.id}
                  className={cn(
                    "flex flex-col items-center rounded-xl border p-3 text-center",
                    has
                      ? "border-distinction/30 bg-distinction-subtle"
                      : "border-border bg-muted/40 opacity-60",
                  )}
                  title={b.description}
                >
                  <span className="text-2xl">{b.icon ?? "🏅"}</span>
                  <span
                    className={cn(
                      "mt-1 text-[11px] font-extrabold",
                      has ? "text-distinction-subtle-foreground" : "text-muted-foreground",
                    )}
                  >
                    {b.name}
                  </span>
                </div>
              );
            })}
          </div>
          {streak && streak.currentDays > 0 ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-distinction-subtle px-3 py-2.5 text-sm font-bold text-distinction-subtle-foreground">
              <Flame className="size-4" />
              {streak.currentDays}-day streak — keep it going!
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
