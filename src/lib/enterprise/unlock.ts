/**
 * Program item unlock resolution (unlockAfterItemId chains).
 * Defensive by design: missing references, forward references, and cycles
 * degrade to UNLOCKED — a misconfigured program must never brick a learner.
 */

export type UnlockableItem = {
  id: string;
  unlockAfterItemId: string | null;
};

/**
 * Returns the set of item ids currently unlocked for a learner, given the set
 * of item ids they have completed. An item is unlocked when it has no
 * prerequisite, its prerequisite is completed, or its prerequisite chain is
 * broken (missing/cyclic).
 */
export function resolveUnlockedItems(
  items: UnlockableItem[],
  completedItemIds: Set<string>,
): Set<string> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const unlocked = new Set<string>();

  for (const item of items) {
    if (!item.unlockAfterItemId) {
      unlocked.add(item.id);
      continue;
    }
    const prereq = byId.get(item.unlockAfterItemId);
    if (!prereq) {
      unlocked.add(item.id); // dangling reference → never brick
      continue;
    }
    // Structural cycle check FIRST — items caught in a cycle could never
    // complete their prerequisites, so gating them would brick the program.
    const seen = new Set<string>([item.id]);
    let cursor: UnlockableItem | undefined = prereq;
    let cyclic = false;
    while (cursor) {
      if (seen.has(cursor.id)) {
        cyclic = true;
        break;
      }
      seen.add(cursor.id);
      cursor = cursor.unlockAfterItemId ? byId.get(cursor.unlockAfterItemId) : undefined;
    }
    // Direct-prerequisite semantics: only the immediate prerequisite gates.
    if (cyclic || completedItemIds.has(prereq.id)) unlocked.add(item.id);
  }
  return unlocked;
}

/** Validates a prospective unlock edge: prerequisite must exist, precede the
 * item by position, and not introduce a cycle. Returns an error string or null. */
export function validateUnlockEdge(
  items: Array<UnlockableItem & { position: number }>,
  itemId: string,
  unlockAfterItemId: string | null,
): string | null {
  if (!unlockAfterItemId) return null;
  if (unlockAfterItemId === itemId) return "An item cannot unlock after itself.";
  const byId = new Map(items.map((i) => [i.id, i]));
  const item = byId.get(itemId);
  const prereq = byId.get(unlockAfterItemId);
  if (!item || !prereq) return "Unknown item reference.";
  if (prereq.position >= item.position) {
    return "The prerequisite must come earlier in the sequence.";
  }
  // cycle check following existing edges plus the proposed one
  let cursor: string | null = unlockAfterItemId;
  const seen = new Set<string>([itemId]);
  while (cursor) {
    if (seen.has(cursor)) return "This would create a circular unlock chain.";
    seen.add(cursor);
    cursor = byId.get(cursor)?.unlockAfterItemId ?? null;
  }
  return null;
}
