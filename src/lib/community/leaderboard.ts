import "server-only";

import { db } from "@/lib/db";

export type LeaderboardRow = {
  rank: number;
  name: string;
  points: number;
  isYou: boolean;
};

export type LeaderboardResult = {
  top: LeaderboardRow[];
  myPoints: number;
  myRank: number;
};

/**
 * Leaderboards are computed views (there is no Leaderboard table) — sum
 * `XpEvent.points` per user. Small demo dataset, so we group all and rank in JS.
 */
export async function getLeaderboard(
  currentUserId: string,
  take = 5,
): Promise<LeaderboardResult> {
  const all = await db.xpEvent.groupBy({
    by: ["userId"],
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
  });

  const topSlice = all.slice(0, take);
  const userIds = topSlice.map((g) => g.userId);
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const top: LeaderboardRow[] = topSlice.map((g, i) => ({
    rank: i + 1,
    name: nameById.get(g.userId) ?? "Learner",
    points: g._sum.points ?? 0,
    isYou: g.userId === currentUserId,
  }));

  const myIndex = all.findIndex((g) => g.userId === currentUserId);
  const myPoints = myIndex >= 0 ? (all[myIndex]._sum.points ?? 0) : 0;
  const myRank = myIndex >= 0 ? myIndex + 1 : all.length + 1;

  return { top, myPoints, myRank };
}
