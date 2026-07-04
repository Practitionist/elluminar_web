"use client";

import { ArrowRight } from "lucide-react";

import { Pill, SectionEyebrow } from "@/components/shared";
import { FadeIn } from "@/components/ui/fade-in";
import { cn } from "@/lib/utils";

// Illustrative outcomes — swap for real, consented learner stories before launch.
const STORIES = [
  {
    initials: "MS",
    name: "Meera Singh",
    path: "Non-CS grad → Backend Engineer",
    before: "₹3.2 LPA",
    after: "₹14 LPA",
    now: "Razorpay",
    tone: "bg-success-subtle text-success-subtle-foreground",
  },
  {
    initials: "DP",
    name: "Dev Prakash",
    path: "Tier-3 college → SDE-1",
    before: "Fresh grad",
    after: "₹16 LPA",
    now: "PhonePe",
    tone: "bg-info-subtle text-info-subtle-foreground",
  },
  {
    initials: "FS",
    name: "Fatima Sheikh",
    path: "Career break → Data Engineer",
    before: "3 yrs out",
    after: "₹19 LPA",
    now: "Swiggy",
    tone: "bg-primary-subtle text-primary-subtle-foreground",
  },
];

export function SuccessStoriesSection() {
  return (
    <section className="w-full bg-muted/40 py-16 md:py-24">
      <div className="container px-4 md:px-6">
        <FadeIn direction="up">
          <div className="mx-auto mb-14 max-w-3xl space-y-6 text-center">
            <SectionEyebrow tone="success">Outcomes</SectionEyebrow>
            <p className="font-display text-2xl leading-[1.4] font-medium tracking-tight text-balance sm:text-3xl md:text-[2rem]">
              &ldquo;I stopped sending my résumé. I send my verify link. Three
              interviews turned into offers because they could{" "}
              <span className="text-primary italic">see the review</span>, not
              just take my word.&rdquo;
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-success-subtle text-sm font-extrabold text-success-subtle-foreground">
                KP
              </span>
              <div className="text-left">
                <div className="text-sm font-extrabold text-foreground">
                  Kavya Patel
                </div>
                <div className="text-xs font-semibold text-muted-foreground">
                  Backend Engineer, now at Zerodha
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        <div className="grid gap-5 md:grid-cols-3">
          {STORIES.map((s, i) => (
            <FadeIn key={s.name} direction="up" delay={0.08 * i}>
              <div className="h-full rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex size-11 items-center justify-center rounded-full text-sm font-extrabold",
                      s.tone,
                    )}
                  >
                    {s.initials}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-extrabold text-foreground">
                      {s.name}
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground">
                      {s.path}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-muted/70 px-4 py-3">
                  <div className="flex-1 text-center">
                    <div className="text-[11px] font-bold text-muted-foreground">
                      Before
                    </div>
                    <div className="text-sm font-extrabold text-muted-foreground">
                      {s.before}
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-success" />
                  <div className="flex-1 text-center">
                    <div className="text-[11px] font-bold text-muted-foreground">
                      After
                    </div>
                    <div className="text-sm font-extrabold text-success-subtle-foreground">
                      {s.after}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Pill tone="success">now @ {s.now}</Pill>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
