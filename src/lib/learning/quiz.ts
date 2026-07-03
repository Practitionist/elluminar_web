import "server-only";

import { db } from "@/lib/db";
import { seededShuffle } from "@/lib/learning/lesson-access";

export function drawQuizQuestions<T>(
  questions: T[],
  seed: number,
  drawCount: number | null,
): T[] {
  const shuffled = seededShuffle(questions, seed);
  return drawCount ? shuffled.slice(0, Math.min(drawCount, shuffled.length)) : shuffled;
}

/** The drawn, shuffled, answer-STRIPPED question set for an attempt (server-only). */
export async function getAttemptQuestions(attemptId: string, userId: string) {
  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: { quiz: { include: { questions: { orderBy: { position: "asc" } } } } },
  });
  if (!attempt || attempt.userId !== userId) return null;
  const drawn = drawQuizQuestions(attempt.quiz.questions, attempt.seed, attempt.quiz.drawCount);
  return {
    attempt,
    questions: drawn.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: (q.prompt as { text?: string })?.text ?? "",
      options: (q.options as { choices?: string[] } | null)?.choices ?? [],
      points: q.points,
    })),
  };
}
