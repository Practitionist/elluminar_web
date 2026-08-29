import { describe, expect, it } from "vitest";

import {
  arrangeHeroCards,
  courseHeroCard,
  projectHeroCard,
  type HeroCard,
  type HeroCourseRow,
  type HeroProjectRow,
} from "@/lib/marketing/hero-cards";

const course = (over: Partial<HeroCourseRow> = {}): HeroCourseRow => ({
  id: "c1",
  title: "Full-Stack Next.js in Production",
  slug: "fullstack-nextjs",
  tenantSlug: "demo-academy",
  level: "INTERMEDIATE",
  liveEnabled: false,
  selfPacedEnabled: true,
  hasOpenCohort: false,
  hasCodeLab: false,
  ...over,
});

const project = (over: Partial<HeroProjectRow> = {}): HeroProjectRow => ({
  id: "p1",
  title: "RAG Assistant over Private Docs",
  slug: "llm-rag-sprint",
  tenantSlug: "datawicket",
  tier: "SPRINT",
  durationWeeksMin: 2,
  durationWeeksMax: 4,
  mentorHours: 2,
  ...over,
});

describe("courseHeroCard", () => {
  it("links to the real tenant-scoped detail page", () => {
    expect(courseHeroCard(course()).href).toBe("/courses/demo-academy/fullstack-nextjs");
  });

  it("says 'Live cohort' only when a cohort actually exists", () => {
    expect(courseHeroCard(course({ hasOpenCohort: true, liveEnabled: true })).subtitle).toBe(
      "Course • Live cohort",
    );
    // liveEnabled but nothing scheduled and self-paced on → don't claim live.
    expect(courseHeroCard(course({ hasOpenCohort: false, liveEnabled: true })).subtitle).toBe(
      "Course • Self-paced",
    );
  });

  it("mentions code labs when the course has CODE_LAB lessons", () => {
    expect(courseHeroCard(course({ hasOpenCohort: true, hasCodeLab: true })).subtitle).toBe(
      "Course • Live cohort · Code labs",
    );
  });

  it("falls back to the bare kind when nothing is known", () => {
    expect(courseHeroCard(course({ selfPacedEnabled: false, liveEnabled: false })).subtitle).toBe(
      "Course",
    );
  });

  it("uses the level as the badge, and nothing when it is unknown", () => {
    expect(courseHeroCard(course()).badge).toBe("Intermediate");
    expect(courseHeroCard(course({ level: null })).badge).toBeNull();
    expect(courseHeroCard(course({ level: "WAT" })).badge).toBeNull();
  });
});

describe("projectHeroCard", () => {
  it("links to the real tenant-scoped detail page", () => {
    expect(projectHeroCard(project()).href).toBe("/projects/datawicket/llm-rag-sprint");
  });

  it("states the tier and mentor review from real fields", () => {
    expect(projectHeroCard(project()).subtitle).toBe("Project • Sprint · Mentor-reviewed");
    // No budgeted mentor time → no mentor-review claim.
    expect(projectHeroCard(project({ mentorHours: 0 })).subtitle).toBe("Project • Sprint");
    expect(projectHeroCard(project({ tier: null, mentorHours: 0 })).subtitle).toBe("Project");
  });

  it("badges the real duration range", () => {
    expect(projectHeroCard(project()).badge).toBe("2–4 weeks");
    expect(projectHeroCard(project({ durationWeeksMin: 3, durationWeeksMax: 3 })).badge).toBe(
      "3 weeks",
    );
    expect(
      projectHeroCard(project({ durationWeeksMin: null, durationWeeksMax: null })).badge,
    ).toBeNull();
  });
});

describe("arrangeHeroCards", () => {
  const card = (key: string): HeroCard => ({
    key,
    title: key,
    href: `/${key}`,
    subtitle: key,
    badge: null,
  });

  it("orders course, project, course", () => {
    const picked = arrangeHeroCards([card("c1"), card("c2"), card("c3")], [card("p1"), card("p2")]);
    expect(picked.map((c) => c.key)).toEqual(["c1", "p1", "c2"]);
  });

  it("returns nothing for an empty catalog", () => {
    expect(arrangeHeroCards([], [])).toEqual([]);
  });

  it("renders fewer cards rather than breaking on a thin catalog", () => {
    expect(arrangeHeroCards([card("c1")], []).map((c) => c.key)).toEqual(["c1"]);
    expect(arrangeHeroCards([card("c1")], [card("p1")]).map((c) => c.key)).toEqual(["c1", "p1"]);
  });

  it("tops up from whichever side has items left", () => {
    expect(arrangeHeroCards([], [card("p1"), card("p2")]).map((c) => c.key)).toEqual(["p1", "p2"]);
    expect(arrangeHeroCards([card("c1"), card("c2"), card("c3")], []).map((c) => c.key)).toEqual([
      "c1",
      "c2",
      "c3",
    ]);
  });

  it("never exceeds the slot count and never repeats an item", () => {
    const picked = arrangeHeroCards([card("c1"), card("c1"), card("c2")], [card("p1")]);
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((c) => c.key)).size).toBe(3);
  });
});
