/**
 * Which persisted Lesson fields are meaningful for which LessonType.
 *
 * Pure predicates with no db/storage imports, so authoring rules are
 * unit-testable without a database (same shape as `uploads.ts`).
 */

import type { LessonType } from "@/generated/prisma/client";

/**
 * VIDEO is the only type that renders a player: the learner page reads
 * `videoAssetId` behind `type === "VIDEO"`, so an asset attached to an ARTICLE,
 * QUIZ, RESOURCE, … is dead data no surface will ever show.
 *
 * Returning `null` rather than `undefined` for the other types is deliberate —
 * on an update the field must be *written*, so retyping a lesson away from
 * VIDEO clears the stale id instead of leaving it orphaned on the row.
 */
export function videoAssetIdForLessonType(
  type: LessonType,
  videoAssetId: string | null | undefined,
): string | null {
  return type === "VIDEO" ? (videoAssetId ?? null) : null;
}
