"use client";

import { GraduationCap, Hammer, ShieldCheck } from "lucide-react";

import { SectionEyebrow, SectionHeading } from "@/components/shared";
import { FadeIn } from "@/components/ui/fade-in";
import { cn } from "@/lib/utils";

const steps = [
  {
    n: "1",
    icon: GraduationCap,
    tone: "primary" as const,
    gradient: "linear-gradient(135deg, #DCD2FB, #EFEBFF)",
    title: "Learn from people who ship",
    description:
      "Video, in-browser labs, quizzes and live cohort sessions — built by working engineers, not career instructors.",
  },
  {
    n: "2",
    icon: Hammer,
    tone: "distinction" as const,
    gradient: "linear-gradient(135deg, #FFE7C4, #FFF4E3)",
    title: "Build a project that's judged",
    description:
      "An ambiguous, real-world brief with milestones — reviewed line-by-line by a senior mentor against a public rubric.",
  },
  {
    n: "3",
    icon: ShieldCheck,
    tone: "success" as const,
    gradient: "linear-gradient(135deg, #BFE8D2, #E9F8EF)",
    title: "Defend it, get verified",
    description:
      "Clear a live defense call and earn a credential with public rubric scores any recruiter can check — forever.",
  },
];

const NUMBER_TONE = {
  primary: "text-primary",
  distinction: "text-distinction-subtle-foreground",
  success: "text-success-subtle-foreground",
};

export function HowItWorksSection() {
  return (
    <section className="w-full py-16 md:py-24 lg:py-28">
      <div className="container px-4 md:px-6">
        <FadeIn direction="up">
          <div className="mb-14 flex flex-col items-center space-y-4 text-center">
            <SectionEyebrow tone="distinction">How it works</SectionEyebrow>
            <SectionHeading>
              Three steps between you and{" "}
              <span className="text-primary italic">proof</span>
            </SectionHeading>
          </div>
        </FadeIn>

        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <FadeIn key={step.n} direction="up" delay={0.1 * (i + 1)}>
              <div className="h-full rounded-3xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-foreground/5">
                <div
                  className="relative mb-5 flex h-32 items-start justify-start overflow-hidden rounded-2xl p-5"
                  style={{ backgroundImage: step.gradient }}
                >
                  <span
                    className={cn(
                      "inline-flex size-11 items-center justify-center rounded-xl bg-white text-xl font-extrabold shadow-sm",
                      NUMBER_TONE[step.tone],
                    )}
                  >
                    {step.n}
                  </span>
                  <step.icon className="absolute right-4 bottom-4 size-8 text-foreground/30" />
                </div>
                <h3 className="mb-2 text-lg font-extrabold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
