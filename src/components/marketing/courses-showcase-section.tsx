"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import {
  CourseCard,
  type CourseCardData,
  SectionEyebrow,
  SectionHeading,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";

// Illustrative catalog — the CourseCard binds to real `Course` rows in the
// catalog rollout; here we curate a representative set for the landing.
const COURSES: CourseCardData[] = [
  {
    title: "Backend Engineering with Node & Postgres",
    href: "/courses",
    metaLabel: "42 lessons",
    creatorLabel: "Rohan S · Flipkart",
    rating: 4.8,
    ratingCount: 312,
    price: { label: "₹1,499", compareLabel: "₹2,999", isFree: false },
  },
  {
    title: "System Design for Interviews & Real Life",
    href: "/courses",
    metaLabel: "36 lessons",
    creatorLabel: "Meera J · Zerodha",
    rating: 4.7,
    ratingCount: 210,
    price: { label: "₹2,999", isFree: false },
  },
  {
    title: "Git & GitHub for Absolute Beginners",
    href: "/courses",
    metaLabel: "28 lessons",
    creatorLabel: "elluminar Team",
    rating: 4.6,
    ratingCount: 540,
    price: { label: "Free", isFree: true },
  },
  {
    title: "Docker & Kubernetes, Production First",
    href: "/courses",
    metaLabel: "51 lessons",
    creatorLabel: "Arif B · Swiggy",
    rating: 4.5,
    ratingCount: 148,
    price: { label: "₹1,999", isFree: false },
  },
];

export function CoursesShowcaseSection() {
  return (
    <section className="w-full py-16 md:py-24">
      <div className="container px-4 md:px-6">
        <FadeIn direction="up">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-4">
              <SectionEyebrow>Learn</SectionEyebrow>
              <SectionHeading>Courses that go deep</SectionHeading>
            </div>
            <Button
              render={<Link href="/courses" />}
              variant="ghost"
              className="rounded-full font-bold text-primary hover:text-primary"
            >
              All courses <ArrowRight className="ml-1 size-4" />
            </Button>
          </div>
        </FadeIn>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {COURSES.map((c, i) => (
            <FadeIn key={c.title} direction="up" delay={0.06 * i}>
              <CourseCard course={c} />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
