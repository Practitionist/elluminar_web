"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Award,
  BookOpen,
  GraduationCap,
  Target,
  Trophy,
} from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

export function CoursesSection() {
  const stats = [
    { icon: BookOpen, value: "300+", label: "Courses" },
    { icon: GraduationCap, value: "200+", label: "Creators" },
    { icon: Trophy, value: "4.9", label: "Avg Rating" },
    { icon: Award, value: "100%", label: "À la carte" },
  ];

  return (
    <section className="w-full py-16 md:py-28 lg:py-36 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-30" />

      <div className="container px-4 md:px-6 relative">
        <FadeIn direction="left" delay={0.2}>
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-20 items-center">
            <div className="space-y-10">
              <div className="space-y-5">
                <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary border border-primary/20">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Learn
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                  Courses That Go Deep
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Recorded and live-cohort courses from independent technical
                  creators. Every course comes with embedded code labs,
                  quizzes, and real assignments — not just videos to watch.
                </p>
              </div>

              <div className="grid gap-5">
                <div className="flex items-start gap-4 p-5 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:bg-card hover:shadow-md transition-all duration-300 group">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20 shrink-0 group-hover:scale-105 transition-transform">
                    <GraduationCap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">
                      Creator-Led Content
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Learn from independent technical creators who work in the
                      field
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-5 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:bg-card hover:shadow-md transition-all duration-300 group">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20 shrink-0 group-hover:scale-105 transition-transform">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Practice-Focused</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Apply concepts immediately with embedded code labs and
                      real assignments
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Button
                  render={<Link href="/courses" />}
                  size="lg"
                  className="gap-2 rounded-full px-8 shadow-lg hover:shadow-xl glow-primary transition-all duration-300 group"
                >
                  Browse Courses
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center lg:justify-end">
              <div className="relative w-full max-w-lg aspect-square">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-500/15 to-pink-500/10 rounded-3xl blur-3xl animate-pulse-glow opacity-70" />
                <div className="absolute inset-8 grid grid-cols-2 gap-6">
                  {stats.map((item, index) => (
                    <div
                      key={index}
                      className="flex flex-col justify-center items-center rounded-2xl bg-card/90 backdrop-blur-sm border border-border/50 shadow-lg hover:shadow-2xl hover:scale-105 hover:border-primary/30 transition-all duration-500 p-6 group"
                      style={{
                        marginTop:
                          index % 2 === 1 ? "2rem" : index > 1 ? "-1rem" : 0,
                      }}
                    >
                      <item.icon className="h-12 w-12 text-primary mb-3 group-hover:scale-110 transition-transform" />
                      <span className="text-3xl font-bold text-gradient">
                        {item.value}
                      </span>
                      <span className="text-sm text-muted-foreground font-medium mt-1">
                        {item.label}
                      </span>
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
