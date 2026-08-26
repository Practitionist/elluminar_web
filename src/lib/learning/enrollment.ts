import { db } from "@/lib/db";
import { ActionError } from "@/lib/safe-action";

/**
 * The learner's active enrollment for a course, or an actionable error.
 *
 * Shared by every learner-side action (progress, quiz, assignment submit,
 * submission uploads) so the "enrolled?" question has exactly one answer.
 */
export async function requireActiveEnrollment(userId: string, courseId: string) {
  const enrollment = await db.enrollment.findFirst({
    where: { userId, courseId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!enrollment) throw new ActionError("You're not enrolled in this course.");
  return enrollment;
}
