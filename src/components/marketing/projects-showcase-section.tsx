"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import {
  ProjectCard,
  type ProjectCardData,
  SectionEyebrow,
  SectionHeading,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";

// Illustrative — binds to real `Project` rows in the catalog rollout.
const PROJECTS: ProjectCardData[] = [
  {
    title: "Payments API — Build, Scale, Defend",
    href: "/projects",
    tierLabel: "Capstone",
    durationLabel: "6-wk capstone",
    partnerLabel: "Vikram K · Razorpay",
    rating: 4.9,
    ratingCount: 87,
    price: { label: "₹5,999", compareLabel: "₹9,999", isFree: false },
  },
  {
    title: "Rate Limiter from Scratch — Reviewed",
    href: "/projects",
    tierLabel: "Sprint",
    durationLabel: "4-wk project",
    partnerLabel: "Rohan S · Flipkart",
    rating: 4.8,
    ratingCount: 64,
    price: { label: "₹2,999", isFree: false },
  },
  {
    title: "Realtime Chat — Ship the Backend",
    href: "/projects",
    tierLabel: "Sprint",
    durationLabel: "5-wk project",
    partnerLabel: "Shreya D · CRED",
    rating: 4.9,
    ratingCount: 51,
    price: { label: "₹3,499", isFree: false },
  },
];

export function ProjectsShowcaseSection() {
  return (
    <section className="w-full bg-muted/40 py-16 md:py-24">
      <div className="container px-4 md:px-6">
        <FadeIn direction="up">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-4">
              <SectionEyebrow tone="distinction">Build</SectionEyebrow>
              <SectionHeading>
                Projects that read like real tickets
              </SectionHeading>
            </div>
            <Button
              render={<Link href="/projects" />}
              variant="ghost"
              className="rounded-full font-bold text-primary hover:text-primary"
            >
              All projects <ArrowRight className="ml-1 size-4" />
            </Button>
          </div>
        </FadeIn>
        <p className="mb-10 max-w-xl text-muted-foreground">
          Ambiguous, production-flavoured briefs — reviewed line-by-line by a
          senior engineer, then defended live.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.map((p, i) => (
            <FadeIn key={p.title} direction="up" delay={0.08 * i}>
              <ProjectCard project={p} />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
