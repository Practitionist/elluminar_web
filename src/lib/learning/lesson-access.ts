import "server-only";

import type { Enrollment, Lesson } from "@/generated/prisma/client";

/** Drip gating: a lesson unlocks by absolute date and/or days-since-enrollment. */
export function isLessonUnlocked(
  lesson: Pick<Lesson, "releaseAt" | "releaseAfterDays" | "isFreePreview">,
  enrollment: Pick<Enrollment, "activatedAt"> | null,
): { unlocked: boolean; unlocksAt: Date | null } {
  if (lesson.isFreePreview) return { unlocked: true, unlocksAt: null };
  if (!enrollment) return { unlocked: false, unlocksAt: null };

  const candidates: Date[] = [];
  if (lesson.releaseAt) candidates.push(lesson.releaseAt);
  if (lesson.releaseAfterDays != null) {
    candidates.push(
      new Date(enrollment.activatedAt.getTime() + lesson.releaseAfterDays * 86400_000),
    );
  }
  if (candidates.length === 0) return { unlocked: true, unlocksAt: null };
  const unlocksAt = new Date(Math.max(...candidates.map((d) => d.getTime())));
  return { unlocked: unlocksAt <= new Date(), unlocksAt };
}

/** Deterministic seeded shuffle (Fisher–Yates over a mulberry32 stream). */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let a = seed >>> 0;
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
