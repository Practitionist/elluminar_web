"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle,
  Code2,
  Rocket,
  Users,
} from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

export function EmpowerSection() {
  return (
    <section className="w-full py-16 md:py-28 lg:py-36 relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 gradient-mesh opacity-50" />

      <div className="container px-4 md:px-6 relative">
        <FadeIn direction="up" delay={0.1}>
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-20 items-center">
            <div className="flex flex-col justify-center space-y-10">
              <div className="space-y-6">
                <h2 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                  Build Skills
                  <br />
                  <span className="text-gradient">Launch Careers</span>
                </h2>

                <p className="max-w-[600px] text-muted-foreground text-lg md:text-xl leading-relaxed">
                  Mentor-reviewed projects at take-home-assessment scale,
                  rubric-graded checkpoints, and verifiable credentials that
                  make your portfolio carry real proof.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  render={<Link href="/projects" />}
                  size="lg"
                  className="w-full sm:w-auto px-8 text-base rounded-full shadow-lg hover:shadow-xl glow-primary transition-all duration-300 group"
                >
                  Browse Projects
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  render={<Link href="/courses" />}
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto px-8 text-base rounded-full border-2 hover:bg-primary/5 transition-all duration-300"
                >
                  Browse Courses
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center lg:justify-end">
              <div className="relative w-full max-w-lg aspect-square">
                {/* Animated background glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-purple-500/15 to-pink-500/10 rounded-3xl blur-3xl animate-pulse-glow" />
                <div className="absolute inset-8 grid grid-cols-3 gap-5">
                  {[
                    { icon: Code2 },
                    { icon: Rocket },
                    { icon: Award },
                    { icon: BookOpen },
                    { icon: Users },
                    { icon: CheckCircle },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-center rounded-2xl bg-card/80 backdrop-blur-sm border border-primary/10 shadow-lg hover:shadow-2xl hover:scale-110 hover:border-primary/30 hover:bg-card transition-all duration-300 aspect-square p-6 group"
                      style={{
                        gridColumn:
                          index === 0
                            ? 1
                            : index === 1
                              ? 2
                              : index === 2
                                ? 3
                                : index === 3
                                  ? 1
                                  : index === 4
                                    ? 3
                                    : 2,
                        gridRow: index < 3 ? 1 : index < 5 ? 2 : 3,
                      }}
                    >
                      <item.icon className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
