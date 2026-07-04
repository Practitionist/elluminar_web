"use client";

import { Quote, Star } from "lucide-react";

import { SectionEyebrow, SectionHeading } from "@/components/shared";
import { FadeIn } from "@/components/ui/fade-in";
import { cn } from "@/lib/utils";

// Illustrative — swap for real, consented learner testimonials before launch.
const TESTIMONIALS = [
  {
    name: "Priya Sharma",
    role: "Backend Engineer",
    initials: "PS",
    tone: "bg-primary-subtle text-primary-subtle-foreground",
    quote:
      "The mentor-reviewed projects feel like real take-home assessments — the revision loops taught me more than any video course ever did.",
    highlighted: true,
  },
  {
    name: "Rahul Verma",
    role: "Career switcher",
    initials: "RV",
    tone: "bg-info-subtle text-info-subtle-foreground",
    quote:
      "Buying a single project instead of a whole bootcamp was exactly what I needed. The verified credential went straight onto my portfolio.",
    highlighted: false,
  },
  {
    name: "Ananya Reddy",
    role: "Engineering graduate",
    initials: "AR",
    tone: "bg-success-subtle text-success-subtle-foreground",
    quote:
      "The embedded code labs make courses genuinely hands-on, and the mentor feedback on my submissions has been fantastic. A game-changer.",
    highlighted: false,
  },
];

export function TestimonialsSection() {
  return (
    <section className="w-full py-16 md:py-24">
      <div className="container px-4 md:px-6">
        <FadeIn direction="up">
          <div className="mx-auto mb-14 flex max-w-2xl flex-col items-center space-y-4 text-center">
            <SectionEyebrow icon={<Star className="size-3.5 fill-current" />}>
              Testimonials
            </SectionEyebrow>
            <SectionHeading>
              Loved by people who{" "}
              <span className="text-primary italic">ship</span>
            </SectionHeading>
          </div>
        </FadeIn>

        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <FadeIn key={t.name} direction="up" delay={0.08 * i}>
              <figure
                className={cn(
                  "flex h-full flex-col rounded-3xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-foreground/5",
                  t.highlighted
                    ? "border-primary/30 shadow-lg shadow-primary/5"
                    : "border-border",
                )}
              >
                <Quote className="size-7 text-primary/30" />
                <blockquote className="mt-3 flex-1 text-[0.95rem] leading-relaxed text-foreground/90">
                  {t.quote}
                </blockquote>
                <div className="mt-5 flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex size-10 items-center justify-center rounded-full text-sm font-extrabold",
                      t.tone,
                    )}
                  >
                    {t.initials}
                  </span>
                  <div className="flex-1">
                    <figcaption className="text-sm font-extrabold text-foreground">
                      {t.name}
                    </figcaption>
                    <div className="text-xs font-semibold text-muted-foreground">
                      {t.role}
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star
                        key={s}
                        className="size-3.5 fill-distinction text-distinction"
                      />
                    ))}
                  </div>
                </div>
              </figure>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
