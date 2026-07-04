"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronRight, MessageSquare } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

const faqs = [
  {
    question: "What is lms-web?",
    answer:
      "lms-web is a marketplace where independent technical creators teach courses and live cohorts, and real mentors review your projects. You buy exactly what you need — a single course or a single project — and your portfolio carries verifiable proof of work, not just certificates.",
  },
  {
    question: "Do I have to buy a bundle or subscription?",
    answer:
      "No. Everything is à la carte, always. One cart for exactly what you need, with a clear 14-day refund window. Memberships exist for breadth and guided support, but they never gate a single purchase.",
  },
  {
    question: "How do mentor-reviewed projects work?",
    answer:
      "Each project is scoped at take-home-assessment scale with rubric-graded checkpoints. You submit your work, a real mentor reviews it, and you go through revision loops until you meet the bar. Completing a project earns a verifiable credential.",
  },
  {
    question: "What does membership cost?",
    answer:
      "The Free tier lets you browse the marketplace and buy à la carte. Learn is ₹999/month for the full self-paced library, Mentor is ₹2,499/month adding live cohorts and Sprint project credits, and Career is ₹4,999/month with priority mentor matching and placement support.",
  },
];

export function FAQSection() {
  return (
    <section className="w-full py-16 md:py-28 lg:py-36 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-30" />

      <div className="container px-4 md:px-6 relative">
        <FadeIn direction="up" delay={0.2}>
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Left Side - Header */}
            <div className="space-y-8">
              <div className="space-y-5">
                <div className="inline-block">
                  <span className="inline-flex items-center text-sm font-semibold text-primary uppercase tracking-wider bg-primary/10 px-4 py-1.5 rounded-full">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    FAQ
                  </span>
                </div>
                <h2 className="font-display text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl">
                  Questions?
                  <br />
                  We&apos;ve <span className="text-primary italic">
                    got answers
                  </span>
                </h2>
                <p className="text-muted-foreground text-lg">
                  Wondering how lms-web works? Our FAQ section has all the
                  answers you need!
                </p>
              </div>
              <Button
                render={<Link href="/sign-up" />}
                size="lg"
                className="rounded-full gap-2 glow-primary transition-all duration-300 group"
              >
                Get Started Free
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>

            {/* Right Side - FAQ Items */}
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <details
                  key={index}
                  className="group bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 hover:border-primary/25 hover:shadow-md transition-all duration-300"
                >
                  <summary className="flex items-center justify-between p-5 cursor-pointer font-semibold text-base">
                    {faq.question}
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-open:rotate-90" />
                  </summary>
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
