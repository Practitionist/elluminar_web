import { cn } from "@/lib/utils";

import { Pill } from "./pill";

export type MentorCardData = {
  name: string;
  headline: string; // e.g. "L6 Backend · Razorpay" (MentorProfile.headline)
  levelLabel?: string; // "Senior" | "Principal" (MentorProfile.level)
  initials?: string;
  tags?: string[]; // expertiseTags
  reviewsLabel?: string; // optional, aggregated ("87 reviews · payments")
};

const AVATAR_TONES = [
  "bg-primary-subtle text-primary-subtle-foreground",
  "bg-info-subtle text-info-subtle-foreground",
  "bg-success-subtle text-success-subtle-foreground",
  "bg-distinction-subtle text-distinction-subtle-foreground",
];

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function MentorCard({
  mentor,
  className,
}: {
  mentor: MentorCardData;
  className?: string;
}) {
  const initials = mentor.initials ?? initialsOf(mentor.name);
  const tone = AVATAR_TONES[initials.charCodeAt(0) % AVATAR_TONES.length];
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-border bg-card p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-md",
        className,
      )}
    >
      <span
        className={cn(
          "mb-3 inline-flex size-14 items-center justify-center rounded-full text-sm font-extrabold",
          tone,
        )}
      >
        {initials}
      </span>
      <div className="text-sm font-extrabold text-foreground">{mentor.name}</div>
      <div className="mt-0.5 text-xs font-semibold text-muted-foreground">
        {mentor.headline}
      </div>
      {mentor.levelLabel ? (
        <Pill tone="primary" className="mt-2 px-2.5 py-0.5 text-[11px]">
          {mentor.levelLabel}
        </Pill>
      ) : null}
      {mentor.reviewsLabel ? (
        <div className="mt-2 text-[11px] font-semibold text-muted-foreground">
          {mentor.reviewsLabel}
        </div>
      ) : null}
    </div>
  );
}
