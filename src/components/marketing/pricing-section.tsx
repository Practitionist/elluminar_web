"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, Crown, Rocket, Sparkles } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

const plans = [
  {
    name: "Free",
    description: "Explore the marketplace",
    price: "₹0",
    priceNote: "Free forever",
    features: [
      "Browse the full marketplace",
      "Buy any course or project à la carte",
      "Free preview lessons",
      "14-day refund window",
    ],
    cta: "Sign Up Free",
    ctaLink: "/sign-up",
    variant: "outline" as const,
    highlighted: false,
    elite: false,
  },
  {
    name: "Learn",
    description: "The full self-paced library",
    price: "₹999",
    priceSuffix: "/mo",
    priceNote: "or ₹9,999/year",
    features: [
      "Everything in Free",
      "Full self-paced library",
      "Cohort replay access",
      "5% off à la carte",
      "50 AI credits/day",
    ],
    cta: "Get Learn",
    ctaLink: "/pricing",
    variant: "default" as const,
    highlighted: false,
    elite: false,
    icon: Rocket,
  },
  {
    name: "Mentor",
    description: "Guided practice with real mentors",
    price: "₹2,499",
    priceSuffix: "/mo",
    priceNote: "or ₹24,999/year",
    features: [
      "Everything in Learn",
      "Live cohorts included",
      "1 Sprint project credit/mo",
      "20% off Capstone projects",
      "Verified proof-of-work portfolio",
      "150 AI credits/day",
    ],
    cta: "Get Mentor",
    ctaLink: "/pricing",
    variant: "default" as const,
    highlighted: true,
    elite: false,
    icon: Sparkles,
    badge: "Popular",
  },
  {
    name: "Career",
    description: "A mentor-backed career outcome",
    price: "₹4,999",
    priceSuffix: "/mo",
    priceNote: "or ₹49,999/year",
    features: [
      "Everything in Mentor",
      "Priority cohort seats",
      "2 Sprint project credits/mo",
      "Priority mentor matching",
      "Visible to hiring partners",
      "Placement support intake",
      "300 AI credits/day",
    ],
    cta: "Get Career",
    ctaLink: "/pricing",
    variant: "default" as const,
    highlighted: false,
    elite: true,
    icon: Crown,
  },
];

export function PricingSection() {
  return (
    <section className="w-full py-16 md:py-28 lg:py-36 relative overflow-hidden bg-muted/20">
      <div className="container px-4 md:px-6 relative">
        <FadeIn direction="up" delay={0.2}>
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
            <div className="space-y-5">
              <div className="inline-block">
                <span className="inline-flex items-center text-sm font-semibold text-primary uppercase tracking-wider bg-primary/10 px-4 py-1.5 rounded-full">
                  Pricing
                </span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Simple, <span className="text-gradient">Transparent</span>{" "}
                Pricing
              </h2>
              <p className="max-w-[700px] text-muted-foreground text-lg md:text-xl mx-auto">
                Every tier keeps à la carte open — memberships add breadth and
                guided support, they never gate a single purchase
              </p>
            </div>
          </div>

          <div className="mx-auto max-w-7xl grid gap-6 lg:grid-cols-4 md:grid-cols-2">
            {plans.map((plan, index) => (
              <Card
                key={index}
                className={`flex flex-col rounded-3xl transition-all duration-500 ${
                  plan.highlighted
                    ? "border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-purple-500/5 to-card shadow-2xl scale-105 relative glow-primary"
                    : plan.elite
                      ? "border border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-card backdrop-blur-sm hover:border-yellow-500/50 hover:shadow-xl hover:-translate-y-2"
                      : "border border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/30 hover:shadow-xl hover:-translate-y-2"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="rounded-full bg-gradient-to-r from-primary to-purple-600 px-5 py-1.5 text-xs font-bold text-white shadow-lg">
                      {plan.badge}
                    </span>
                  </div>
                )}
                <CardHeader className={plan.badge ? "pt-8" : ""}>
                  <CardTitle className="flex items-center gap-2">
                    {plan.icon && (
                      <plan.icon
                        className={`h-5 w-5 ${
                          plan.elite
                            ? "text-yellow-600 dark:text-yellow-500"
                            : "text-primary"
                        }`}
                      />
                    )}
                    {plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-4xl font-bold ${plan.highlighted ? "text-gradient" : ""}`}
                      >
                        {plan.price}
                      </span>
                      {plan.priceSuffix && (
                        <span className="text-sm text-muted-foreground">
                          {plan.priceSuffix}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {plan.priceNote}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    render={<Link href={plan.ctaLink} />}
                    variant={plan.variant}
                    className={`w-full rounded-full ${
                      plan.variant === "default"
                        ? "shadow-lg hover:shadow-xl"
                        : "border-border/50 hover:border-primary/30"
                    } transition-all duration-300`}
                  >
                    {plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
