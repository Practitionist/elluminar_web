/**
 * Pure mappers for the landing-page hero showcase cards.
 *
 * Deliberately free of Prisma / `server-only` imports so the label logic stays
 * unit-testable. Every string produced here is derived from a real catalog
 * field: no enrollment counts, no likes, no ratings, no invented social proof.
 * A pre-launch catalog has no engagement to report, and India's CCPA/ASCI
 * guidelines are actively enforced against unsubstantiated edtech claims — so
 * where a fact is missing we drop the element rather than fill it in.
 */

/** What the hero renders per card. All plain strings — safe to cache. */
export type HeroCard = {
  /** Stable React key (`course:<id>` / `project:<id>`). */
  key: string;
  title: string;
  /** Real catalog detail-page href. */
  href: string;
  /** e.g. `Course • Live cohort · Code labs` — each clause from a real field. */
  subtitle: string;
  /** Factual catalog attribute (course level, project duration) or null. */
  badge: string | null;
};

export type HeroCourseRow = {
  id: string;
  title: string;
  slug: string;
  tenantSlug: string;
  level: string | null;
  liveEnabled: boolean;
  selfPacedEnabled: boolean;
  /** A cohort that is OPEN or RUNNING exists. */
  hasOpenCohort: boolean;
  /** At least one CODE_LAB lesson exists. */
  hasCodeLab: boolean;
};

export type HeroProjectRow = {
  id: string;
  title: string;
  slug: string;
  tenantSlug: string;
  tier: string | null;
  durationWeeksMin: number | null;
  durationWeeksMax: number | null;
  /** `Project.mentorHoursBudget` as a number. */
  mentorHours: number;
};

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const TIER_LABEL: Record<string, string> = {
  SPRINT: "Sprint",
  CAPSTONE: "Capstone",
  FLAGSHIP: "Flagship",
};

function subtitleOf(kind: string, facts: string[]): string {
  return facts.length > 0 ? `${kind} • ${facts.join(" · ")}` : kind;
}

function durationLabel(min: number | null, max: number | null): string | null {
  const lo = min ?? max;
  const hi = max ?? min;
  if (!lo || !hi) return null;
  return lo === hi ? `${lo} weeks` : `${lo}–${hi} weeks`;
}

export function courseHeroCard(course: HeroCourseRow): HeroCard {
  const facts: string[] = [];
  // Only claim "live" when a cohort actually exists to join (or the creator has
  // switched live delivery on and self-paced off); otherwise say what it is.
  if (course.hasOpenCohort || (course.liveEnabled && !course.selfPacedEnabled)) {
    facts.push("Live cohort");
  } else if (course.selfPacedEnabled) {
    facts.push("Self-paced");
  }
  if (course.hasCodeLab) facts.push("Code labs");

  return {
    key: `course:${course.id}`,
    title: course.title,
    href: `/courses/${course.tenantSlug}/${course.slug}`,
    subtitle: subtitleOf("Course", facts),
    badge: (course.level ? LEVEL_LABEL[course.level] : null) ?? null,
  };
}

export function projectHeroCard(project: HeroProjectRow): HeroCard {
  const facts: string[] = [];
  const tier = project.tier ? TIER_LABEL[project.tier] : null;
  if (tier) facts.push(tier);
  // The differentiator — stated only when mentor time is actually budgeted.
  if (project.mentorHours > 0) facts.push("Mentor-reviewed");

  return {
    key: `project:${project.id}`,
    title: project.title,
    href: `/projects/${project.tenantSlug}/${project.slug}`,
    subtitle: subtitleOf("Project", facts),
    badge: durationLabel(project.durationWeeksMin, project.durationWeeksMax),
  };
}

/**
 * Deterministic slot order: course, project, course — the middle (featured)
 * slot goes to the mentor-reviewed project, the product's differentiator.
 * Missing slots are topped up from whatever is left, so a partially seeded
 * catalog still fills as many slots as it honestly can.
 */
export function arrangeHeroCards(courses: HeroCard[], projects: HeroCard[], limit = 3): HeroCard[] {
  const picked: HeroCard[] = [];
  const push = (card: HeroCard | undefined) => {
    if (!card) return;
    if (picked.length >= limit) return;
    if (picked.some((p) => p.key === card.key)) return;
    picked.push(card);
  };

  push(courses[0]);
  push(projects[0]);
  push(courses[1]);
  for (const card of [...projects.slice(1), ...courses.slice(2)]) push(card);

  return picked;
}
