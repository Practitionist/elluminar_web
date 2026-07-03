"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  Code,
  Cpu,
  Trophy,
  Users,
} from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

const features = [
  {
    icon: BookOpen,
    title: "Creator-Led Courses",
    description:
      "Recorded and live-cohort courses from independent technical creators — with embedded code labs, quizzes, and real assignments.",
  },
  {
    icon: CheckCircle,
    title: "Rubric-Graded Projects",
    description:
      "Every project ships with clear milestones and rubric-graded checkpoints, so you build skills systematically and know where you stand.",
  },
  {
    icon: Trophy,
    title: "Verifiable Credentials",
    description:
      "Finish a mentor-reviewed project and earn a credential anyone can verify — proof of work, not just a certificate of attendance.",
  },
  {
    icon: Users,
    title: "Real Mentorship",
    description:
      "Experienced engineers review your submissions, run revision loops, and help you get unstuck without giving away the answers.",
  },
  {
    icon: Code,
    title: "Embedded Code Labs",
    description:
      "Practice inside the course with hands-on labs and assignments that mirror the tools and workflows used in real teams.",
  },
  {
    icon: Cpu,
    title: "À La Carte, Always",
    description:
      "No forced bundles. Buy a single course or a single project — one cart for exactly what you need, with a 14-day refund window.",
  },
];

export function FeaturesSection() {
  return (
    <section className="w-full py-16 md:py-28 lg:py-36 relative overflow-hidden">
      {/* Rich gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/98 to-black" />
      {/* Gradient orbs */}
      <div className="absolute top-20 left-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl" />

      <div className="container px-4 md:px-6 relative text-white">
        <FadeIn direction="up" delay={0.2}>
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
            <div className="space-y-5">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Superpowers
                <br />
                for Your <span className="text-gradient">Portfolio</span>
              </h2>
              <p className="max-w-[700px] text-white/60 text-lg md:text-xl mx-auto">
                Everything you need to learn by building — and prove it with
                mentor-verified work
              </p>
            </div>
          </div>

          <div className="mx-auto max-w-6xl grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((item, index) => (
              <Card
                key={index}
                className="bg-white/5 backdrop-blur-sm border-white/10 hover:border-primary/40 hover:bg-white/8 transition-all duration-500 hover:-translate-y-1 group"
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-purple-500/15 border border-primary/20 group-hover:scale-105 transition-transform">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-white">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-white/60">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-center mt-14">
            <Button
              render={<Link href="/courses" />}
              size="lg"
              className="rounded-full px-8 shadow-lg hover:shadow-xl glow-primary transition-all duration-300 group"
            >
              Explore More
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
