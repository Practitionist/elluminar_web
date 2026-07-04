"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import {
  MentorCard,
  type MentorCardData,
  SectionEyebrow,
  SectionHeading,
} from "@/components/shared";
import { FadeIn } from "@/components/ui/fade-in";

// Illustrative — binds to real `MentorProfile` rows in the mentor rollout.
const MENTORS: MentorCardData[] = [
  {
    name: "Vikram K",
    headline: "L6 Backend · Razorpay",
    levelLabel: "Principal",
    reviewsLabel: "87 reviews · payments infra",
  },
  {
    name: "Shreya D",
    headline: "Staff · CRED",
    levelLabel: "Principal",
    reviewsLabel: "64 reviews · distributed systems",
  },
  {
    name: "Arjun N",
    headline: "Senior · ex-Stripe",
    levelLabel: "Senior",
    reviewsLabel: "52 reviews · APIs at scale",
  },
];

export function MentorWallSection() {
  return (
    <section className="w-full py-16 md:py-24">
      <div className="container px-4 md:px-6">
        <FadeIn direction="up">
          <div className="mb-10 max-w-2xl space-y-4">
            <SectionEyebrow tone="info">Mentors</SectionEyebrow>
            <SectionHeading>
              Reviewed by people you&apos;d want on your PR
            </SectionHeading>
            <p className="text-muted-foreground">
              Vetted senior engineers moonlighting as mentors. Their name is on
              your verdict.
            </p>
          </div>
        </FadeIn>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MENTORS.map((m, i) => (
            <FadeIn key={m.name} direction="up" delay={0.08 * i}>
              <MentorCard mentor={m} />
            </FadeIn>
          ))}
          <FadeIn direction="up" delay={0.08 * MENTORS.length}>
            <Link
              href="/projects"
              className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
            >
              <div className="text-2xl font-extrabold text-primary">+183</div>
              <div className="mt-1 text-sm font-bold text-foreground">
                more senior mentors
              </div>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-primary">
                Meet them <ArrowRight className="size-3.5" />
              </span>
            </Link>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
