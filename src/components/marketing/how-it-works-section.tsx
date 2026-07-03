"use client";

import { BookOpen, Code2, Users } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

export function HowItWorksSection() {
  const steps = [
    {
      icon: BookOpen,
      title: "1. Pick Your Learning",
      description:
        "Browse courses and live cohorts from independent technical creators — with embedded code labs, quizzes, and real assignments.",
    },
    {
      icon: Code2,
      title: "2. Build a Project",
      description:
        "Buy a single mentor-reviewed project at take-home-assessment scale. Work through rubric-graded checkpoints at your own pace.",
    },
    {
      icon: Users,
      title: "3. Get Mentor Review",
      description:
        "Real mentors review your work, run revision loops with you, and sign off on a verifiable credential for your portfolio.",
    },
  ];

  return (
    <section className="w-full py-16 md:py-28 lg:py-36 relative overflow-hidden bg-muted/30">
      <div className="container px-4 md:px-6 relative">
        <FadeIn direction="up" delay={0.2}>
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
            <div className="space-y-5">
              <div className="inline-block">
                <span className="inline-flex items-center text-sm font-semibold text-primary uppercase tracking-wider bg-primary/10 px-4 py-1.5 rounded-full">
                  How It Works
                </span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Easy Steps to
                <br />
                Your <span className="text-gradient">Proof of Work</span>
              </h2>
              <p className="max-w-[700px] text-muted-foreground text-lg md:text-xl mx-auto">
                No forced bundles, no bootcamp-scale commitment. One cart for
                exactly what you need — with a clear 14-day refund window.
              </p>
            </div>
          </div>

          <div className="mx-auto grid max-w-6xl gap-8 md:gap-10 lg:grid-cols-3">
            {steps.map((item, index) => (
              <div
                key={index}
                className="group flex flex-col items-center space-y-5 text-center p-8 rounded-3xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-500 hover:-translate-y-2"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-purple-500/10 border border-primary/20 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                  <item.icon className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
