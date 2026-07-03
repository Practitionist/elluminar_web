import { describe, expect, it } from "vitest";

import { resolveUnlockedItems, validateUnlockEdge } from "@/lib/enterprise/unlock";

const item = (id: string, unlockAfterItemId: string | null = null, position = 0) => ({
  id,
  unlockAfterItemId,
  position,
});

describe("resolveUnlockedItems", () => {
  it("unlocks items with no prerequisite", () => {
    const unlocked = resolveUnlockedItems([item("a"), item("b")], new Set());
    expect(unlocked).toEqual(new Set(["a", "b"]));
  });

  it("gates chained items until prerequisites complete", () => {
    const items = [item("a"), item("b", "a"), item("c", "b")];
    expect(resolveUnlockedItems(items, new Set())).toEqual(new Set(["a"]));
    expect(resolveUnlockedItems(items, new Set(["a"]))).toEqual(new Set(["a", "b"]));
    expect(resolveUnlockedItems(items, new Set(["a", "b"]))).toEqual(
      new Set(["a", "b", "c"]),
    );
  });

  it("degrades to unlocked on dangling references (never bricks)", () => {
    const items = [item("a", "ghost"), item("b")];
    expect(resolveUnlockedItems(items, new Set())).toEqual(new Set(["a", "b"]));
  });

  it("degrades to unlocked on cycles (never bricks)", () => {
    const items = [item("a", "b"), item("b", "a")];
    expect(resolveUnlockedItems(items, new Set())).toEqual(new Set(["a", "b"]));
  });

  it("supports branches (two items unlocked by the same prerequisite)", () => {
    const items = [item("a"), item("b", "a"), item("c", "a")];
    expect(resolveUnlockedItems(items, new Set(["a"]))).toEqual(new Set(["a", "b", "c"]));
  });
});

describe("validateUnlockEdge", () => {
  const items = [item("a", null, 0), item("b", "a", 1), item("c", null, 2)];

  it("accepts a valid earlier prerequisite", () => {
    expect(validateUnlockEdge(items, "c", "a")).toBeNull();
  });
  it("rejects self-reference", () => {
    expect(validateUnlockEdge(items, "b", "b")).toMatch(/itself/);
  });
  it("rejects forward references", () => {
    expect(validateUnlockEdge(items, "a", "c")).toMatch(/earlier/);
  });
  it("rejects cycles", () => {
    expect(validateUnlockEdge(items, "a", "b")).toMatch(/earlier|circular/);
  });
  it("accepts clearing the rule", () => {
    expect(validateUnlockEdge(items, "b", null)).toBeNull();
  });
});
