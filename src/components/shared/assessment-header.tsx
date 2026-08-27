import Link from "next/link";

import { Pill, type PillTone } from "./pill";

/**
 * Context header for any graded item a learner opens on its own page.
 *
 * Assessment pages used to render a bare card with a generic "QUIZ" pill and a
 * title, which told a learner nothing about where they were: which course, which
 * section, whether the thing counted, or how it was marked. Two different
 * assessments in two different courses looked identical.
 */

export type AssessmentKind =
  | "QUIZ"
  | "ASSIGNMENT"
  | "MILESTONE"
  | "CAPSTONE"
  | "SPRINT"
  | "FLAGSHIP";

/** What each kind is called, and what it actually means for the learner. */
const KIND: Record<AssessmentKind, { label: string; tone: PillTone; stakes: string }> = {
  QUIZ: {
    label: "Quiz",
    tone: "info",
    stakes: "Auto-marked. Passing completes this lesson.",
  },
  ASSIGNMENT: {
    label: "Assignment",
    tone: "primary",
    stakes: "Reviewed by an instructor. Completes this lesson once graded.",
  },
  MILESTONE: {
    label: "Project milestone",
    tone: "primary",
    stakes: "Reviewed by your mentor against a rubric.",
  },
  CAPSTONE: {
    label: "Capstone project",
    tone: "distinction",
    stakes: "Mentor-reviewed. Passing issues a verifiable credential.",
  },
  SPRINT: {
    label: "Sprint project",
    tone: "info",
    stakes: "Mentor-reviewed. Passing issues a verifiable credential.",
  },
  FLAGSHIP: {
    label: "Flagship project",
    tone: "distinction",
    stakes: "Mentor-reviewed, with a live defense. Issues a verifiable credential.",
  },
};

export type AssessmentFact = { label: string; value: string };

export function AssessmentHeader({
  kind,
  title,
  courseTitle,
  courseHref,
  sectionTitle,
  position,
  facts,
  stakesOverride,
}: {
  kind: AssessmentKind;
  title: string;
  courseTitle: string;
  courseHref: string;
  sectionTitle?: string | null;
  /** e.g. "Lesson 4 of 12" — where this sits in the course. */
  position?: string | null;
  facts?: AssessmentFact[];
  stakesOverride?: string;
}) {
  const meta = KIND[kind];

  return (
    <header className="space-y-4">
      {/* Trail: which course, which section — the thing that was missing. */}
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          <li>
            <Link
              href={courseHref}
              className="font-semibold text-foreground transition-colors hover:text-primary"
            >
              {courseTitle}
            </Link>
          </li>
          {sectionTitle && (
            <>
              <li aria-hidden="true" className="text-muted-foreground/50">
                /
              </li>
              <li>{sectionTitle}</li>
            </>
          )}
          {position && (
            <>
              <li aria-hidden="true" className="text-muted-foreground/50">
                /
              </li>
              <li>{position}</li>
            </>
          )}
        </ol>
      </nav>

      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={meta.tone} className="uppercase tracking-wide">
            {meta.label}
          </Pill>
          <span className="text-sm text-muted-foreground">
            {stakesOverride ?? meta.stakes}
          </span>
        </div>
        <h1 className="font-display text-2xl font-medium tracking-tight text-balance sm:text-3xl">
          {title}
        </h1>
      </div>

      {facts && facts.length > 0 && (
        <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-4">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {f.label}
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
