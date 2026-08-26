import { describe, expect, it } from "vitest";

import {
  parseQueueCursor,
  type QueueCursorFilter,
  queueCursorFilter,
  serializeQueueCursor,
} from "@/lib/learning/grading-queue";

const at = (iso: string) => new Date(iso);

describe("queue cursor round-trip", () => {
  it("survives serialize → parse", () => {
    const cursor = { submittedAt: at("2026-08-20T10:00:00.000Z"), id: "sub_1" };
    const parsed = parseQueueCursor(serializeQueueCursor(cursor));
    expect(parsed?.id).toBe("sub_1");
    expect(parsed?.submittedAt.toISOString()).toBe("2026-08-20T10:00:00.000Z");
  });

  it("keeps ids containing underscores intact", () => {
    const cursor = { submittedAt: at("2026-08-20T10:00:00.000Z"), id: "c_ab_cd" };
    expect(parseQueueCursor(serializeQueueCursor(cursor))?.id).toBe("c_ab_cd");
  });

  it("rejects junk rather than paging from a bogus position", () => {
    expect(parseQueueCursor(undefined)).toBeNull();
    expect(parseQueueCursor("")).toBeNull();
    expect(parseQueueCursor("nonsense")).toBeNull();
    expect(parseQueueCursor("_sub_1")).toBeNull();
    expect(parseQueueCursor("abc_sub_1")).toBeNull();
  });
});

describe("queueCursorFilter", () => {
  it("is empty on the first page", () => {
    expect(queueCursorFilter(null)).toEqual({});
  });

  it("seeks strictly past the cursor, breaking timestamp ties on id", () => {
    const submittedAt = at("2026-08-20T10:00:00.000Z");
    expect(queueCursorFilter({ submittedAt, id: "sub_5" })).toEqual({
      OR: [{ submittedAt: { gt: submittedAt } }, { submittedAt, id: { gt: "sub_5" } }],
    });
  });

  it("never skips rows when the queue shrinks (the offset-pagination bug)", () => {
    // Six pending rows, page size 2. Grading page-1 rows must not cause page 2
    // to jump over rows 3-4 the way `skip: 2` would once the queue shrinks.
    const rows = [1, 2, 3, 4, 5, 6].map((n) => ({
      id: `sub_${n}`,
      submittedAt: at(`2026-08-20T10:0${n}:00.000Z`),
    }));
    const PAGE = 2;
    const matches = (filter: QueueCursorFilter, r: (typeof rows)[number]) => {
      if (!("OR" in filter)) return true;
      const [byTime, byId] = filter.OR;
      return (
        r.submittedAt.getTime() > byTime.submittedAt.gt.getTime() ||
        (r.submittedAt.getTime() === byId.submittedAt.getTime() && r.id > byId.id.gt)
      );
    };

    // Page 1 → rows 1,2. Grade them (remove from the queue).
    let remaining = rows;
    const page1 = remaining.slice(0, PAGE);
    expect(page1.map((r) => r.id)).toEqual(["sub_1", "sub_2"]);
    const cursor = { submittedAt: page1[1].submittedAt, id: page1[1].id };
    remaining = remaining.filter((r) => !page1.includes(r));

    // Page 2 seeks past row 2 — rows 3,4, not the 5,6 that `skip: 2` would give.
    const page2 = remaining.filter((r) => matches(queueCursorFilter(cursor), r)).slice(0, PAGE);
    expect(page2.map((r) => r.id)).toEqual(["sub_3", "sub_4"]);
  });
});
