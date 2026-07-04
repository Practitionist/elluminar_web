"use client";

import { Check, Leaf, Rocket, Sparkles, Zap } from "lucide-react";
import Link from "next/link";

import { SectionEyebrow, SectionHeading } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { cn } from "@/lib/utils";

type Plan = {
  code: string;
  name: string;
  icon: typeof Zap;
  tagline: string;
  price: string;
  suffix?: string;
  note: string;
  cta: string;
  href: string;
  includesLabel: string;
  features: string[];
  popular?: boolean;
  dark?: boolean;
};

const PLANS: Plan[] = [
  {
    code: "FREE",
    name: "Free",
    icon: Leaf,
    tagline: "Explore & learn the basics",
    price: "₹0",
    note: "Free forever",
    cta: "Start free",
    href: "/sign-up",
    includesLabel: "Includes",
    features: [
      "All free courses & previews",
      "Community & discussions",
      "Course completion certificate",
      "14-day refund window",
    ],
  },
  {
    code: "LEARN",
    name: "Learn",
    icon: Zap,
    tagline: "The full self-paced library",
    price: "₹999",
    suffix: "/mo",
    note: "or ₹9,999/year",
    cta: "Get Learn",
    href: "/pricing",
    includesLabel: "Everything in Free, plus",
    features: [
      "Full self-paced library",
      "Cohort replay access",
      "5% off à la carte",
      "50 AI credits/day",
    ],
  },
  {
    code: "MENTOR",
    name: "Mentor",
    icon: Sparkles,
    tagline: "Guided practice with real mentors",
    price: "₹2,499",
    suffix: "/mo",
    note: "or ₹24,999/year",
    cta: "Get Mentor",
    href: "/pricing",
    includesLabel: "Everything in Learn, plus",
    features: [
      "Live cohorts included",
      "1 Sprint project credit/mo",
      "20% off Capstone projects",
      "Verified proof-of-work portfolio",
      "150 AI credits/day",
    ],
    popular: true,
  },
  {
    code: "CAREER",
    name: "Career",
    icon: Rocket,
    tagline: "A mentor-backed career outcome",
    price: "₹4,999",
    suffix: "/mo",
    note: "or ₹49,999/year",
    cta: "Get Career",
    href: "/pricing",
    includesLabel: "Everything in Mentor, plus",
    features: [
      "Priority cohort seats",
      "2 Sprint project credits/mo",
      "Priority mentor matching",
      "Visible to hiring partners",
      "Placement support intake",
      "300 AI credits/day",
    ],
    dark: true,
  },
];

export function PricingSection() {
  return (
    <section className="w-full py-16 md:py-24 lg:py-28">
      <div className="container px-4 md:px-6">
        <FadeIn direction="up">
          <div className="mx-auto mb-14 flex max-w-2xl flex-col items-center space-y-4 text-center">
            <SectionEyebrow>Pricing</SectionEyebrow>
            <SectionHeading>
              Pay for the <span className="text-primary italic">proof</span>,
              not the promise
            </SectionHeading>
            <p className="text-muted-foreground">
              Every tier keeps à la carte open — memberships add breadth and
              guided support, they never gate a single purchase.
            </p>
          </div>
        </FadeIn>

        <div className="mx-auto grid max-w-6xl items-stretch gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => (
            <FadeIn key={plan.code} direction="up" delay={0.06 * i}>
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-3xl border p-6",
                  plan.dark
                    ? "border-transparent bg-ink text-ink-foreground"
                    : plan.popular
                      ? "border-2 border-primary bg-card shadow-xl shadow-primary/10 lg:-translate-y-2"
                      : "border-border bg-card",
                )}
              >
                {plan.popular ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3.5 py-1 text-[11px] font-extrabold whitespace-nowrap text-primary-foreground shadow-lg shadow-primary/30">
                    MOST POPULAR
                  </span>
                ) : null}

                <span
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-xl",
                    plan.dark
                      ? "bg-white/10 text-primary"
                      : plan.popular
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary-subtle text-primary-subtle-foreground",
                  )}
                >
                  <plan.icon className="size-5" />
                </span>

                <div
                  className={cn(
                    "mt-4 text-[0.95rem] font-extrabold",
                    plan.dark ? "text-primary" : "",
                  )}
                >
                  {plan.name}
                </div>
                <p
                  className={cn(
                    "mt-0.5 text-xs font-semibold",
                    plan.dark ? "text-ink-muted" : "text-muted-foreground",
                  )}
                >
                  {plan.tagline}
                </p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight">
                    {plan.price}
                  </span>
                  {plan.suffix ? (
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        plan.dark ? "text-ink-muted" : "text-muted-foreground",
                      )}
                    >
                      {plan.suffix}
                    </span>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "mt-1 text-xs font-semibold",
                    plan.dark
                      ? "text-emerald-400"
                      : "text-success-subtle-foreground",
                  )}
                >
                  {plan.note}
                </div>

                <Button
                  render={<Link href={plan.href} />}
                  className={cn(
                    "mt-5 w-full rounded-full font-bold",
                    plan.dark
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : plan.popular
                        ? ""
                        : "bg-transparent text-foreground ring-1 ring-border ring-inset hover:bg-muted",
                  )}
                >
                  {plan.cta}
                </Button>

                <div
                  className={cn(
                    "mt-6 mb-3 text-[11px] font-extrabold tracking-wider uppercase",
                    plan.dark ? "text-ink-muted" : "text-muted-foreground",
                  )}
                >
                  {plan.includesLabel}
                </div>
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          plan.dark ? "text-emerald-400" : "text-success",
                        )}
                      />
                      <span
                        className={cn(
                          plan.dark
                            ? "text-ink-foreground/85"
                            : "text-muted-foreground",
                        )}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>

        <p className="mt-10 text-center text-xs font-semibold text-muted-foreground">
          All prices inclusive of 18% GST · UPI, cards, netbanking &amp; no-cost
          EMI · cancel anytime
        </p>
      </div>
    </section>
  );
}
