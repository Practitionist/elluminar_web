"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Cpu, Sparkles, Play } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

export function HeroSection() {
  return (
    <section className="w-full py-12 md:py-24 lg:py-32 relative overflow-hidden bg-gradient-to-b from-pink-50/50 via-purple-50/30 to-background">
      {/* Decorative pink diagonal ribbons */}
      <div className="absolute left-0 top-1/4 w-64 h-32 bg-gradient-to-r from-primary/20 to-purple-500/20 transform -rotate-12 -translate-x-32 pointer-events-none" />
      <div className="absolute right-0 top-1/3 w-64 h-32 bg-gradient-to-r from-primary/20 to-purple-500/20 transform rotate-12 translate-x-32 pointer-events-none" />

      <div className="container px-4 md:px-6 relative">
        <FadeIn direction="up" delay={0.1}>
          {/* Centered Hero Content */}
          <div className="flex flex-col items-center text-center space-y-8 mb-16">
            <div className="space-y-6 max-w-4xl">
              <div className="inline-block">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary border border-primary/20">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Courses · Live cohorts · Mentor-reviewed projects
                </span>
              </div>

              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none">
                <span className="bg-gradient-to-r from-primary via-purple-600 to-primary bg-clip-text text-transparent">
                  Learn by Building
                </span>
                <br />
                Prove It with Mentors
              </h1>

              <p className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
                A marketplace where technical creators teach, real mentors
                review your projects, and your portfolio carries proof — not
                just certificates. Buy exactly what you need, à la carte.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                render={<Link href="/projects" />}
                size="lg"
                variant="outline"
                className="px-8 text-base rounded-full border-2 bg-black text-white hover:bg-black/90 hover:text-white"
              >
                Browse Projects
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                render={<Link href="/courses" />}
                size="lg"
                className="px-8 text-base rounded-full shadow-lg hover:shadow-xl"
              >
                Browse Courses
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Showcase Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto relative">
            {/* Card 1 - Systems course */}
            <div className="group relative rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-3">
              <div className="aspect-[4/3] bg-gradient-to-br from-rose-800 via-red-600 to-orange-500 relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-6 left-6 w-20 h-20 border-2 border-white/20 rounded-xl rotate-12" />
                <div className="absolute bottom-12 right-8 w-16 h-16 border-2 border-white/15 rounded-full" />
                <div className="absolute top-1/4 right-1/4 w-3 h-3 bg-white/30 rounded-full" />
                <div className="absolute bottom-1/3 left-1/4 w-2 h-2 bg-white/40 rounded-full" />
                <div className="absolute top-1/2 right-12 w-8 h-[2px] bg-white/20 rotate-45" />

                {/* Glowing icon background */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/10 blur-2xl rounded-full scale-150" />
                    <div className="relative w-16 h-16 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-white/90" />
                    </div>
                  </div>
                </div>

                {/* Like counter - glass effect */}
                <div className="absolute top-4 right-4 bg-black/30 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1.5 border border-white/10">
                  <span className="text-rose-300 text-sm">♥</span>
                  <span className="text-white text-sm font-medium">173</span>
                </div>

                {/* Play button with glow */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="pointer-events-auto w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 hover:scale-110 hover:shadow-xl hover:shadow-primary/50 transition-all duration-300 group-hover:scale-105 cursor-pointer">
                    <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                  </span>
                </div>
              </div>
              <div className="bg-card p-5">
                <h3 className="font-bold text-lg mb-1">
                  Distributed Systems in Go
                </h3>
                <p className="text-sm text-muted-foreground">
                  Course • Live cohort + replays
                </p>
              </div>
            </div>

            {/* Card 2 - Featured (mentor-reviewed project) */}
            <div className="group relative rounded-2xl overflow-hidden shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] transition-all duration-500 hover:-translate-y-3 md:scale-105 md:-translate-y-1 ring-2 ring-primary/20">
              <div className="aspect-[4/3] bg-gradient-to-br from-violet-800 via-fuchsia-600 to-orange-500 relative overflow-hidden">
                {/* Decorative elements - more elaborate for featured */}
                <div className="absolute top-8 left-8 w-24 h-24 border-2 border-white/15 rounded-2xl -rotate-6" />
                <div className="absolute top-12 left-12 w-16 h-16 border border-white/10 rounded-xl rotate-12" />
                <div className="absolute bottom-16 right-6 w-12 h-12 border-2 border-white/20 rounded-full" />
                <div className="absolute bottom-20 right-10 w-6 h-6 bg-white/15 rounded-full" />
                <div className="absolute top-1/3 right-1/3 w-4 h-4 bg-white/20 rounded-full blur-sm" />
                <div className="absolute bottom-1/4 left-1/3 w-3 h-3 bg-white/30 rounded-full" />
                <div className="absolute top-20 right-16 w-12 h-[2px] bg-white/20 -rotate-45" />
                <div className="absolute bottom-24 left-16 w-8 h-[2px] bg-white/15 rotate-12" />

                {/* Glowing icon background */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/15 blur-3xl rounded-full scale-[2]" />
                    <div className="relative w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center shadow-lg">
                      <Cpu className="w-10 h-10 text-white" />
                    </div>
                  </div>
                </div>

                {/* Like counter - glass effect */}
                <div className="absolute top-4 right-4 bg-black/30 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1.5 border border-white/10">
                  <span className="text-pink-300 text-sm">♥</span>
                  <span className="text-white text-sm font-medium">200</span>
                </div>

                {/* Pause button - actively playing state */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="pointer-events-auto w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl shadow-black/20 hover:scale-110 transition-all duration-300 cursor-pointer">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-5 bg-gray-800 rounded-full" />
                      <span className="w-1.5 h-5 bg-gray-800 rounded-full" />
                    </span>
                  </span>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                  <div className="h-full w-3/4 bg-gradient-to-r from-white to-white/90 rounded-r-full" />
                </div>
              </div>
              <div className="bg-card p-5">
                <h3 className="font-bold text-lg mb-1">
                  Realtime ML Pipeline
                </h3>
                <p className="text-sm text-muted-foreground">
                  Project • Mentor-reviewed
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full w-3/4 bg-gradient-to-r from-primary to-fuchsia-500 rounded-full" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    75%
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3 - AI course */}
            <div className="group relative rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-3">
              <div className="aspect-[4/3] bg-gradient-to-br from-teal-800 via-emerald-600 to-cyan-500 relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-8 right-8 w-16 h-16 border-2 border-white/20 rounded-full" />
                <div className="absolute top-10 right-10 w-8 h-8 border border-white/15 rounded-full" />
                <div className="absolute bottom-12 left-8 w-20 h-20 border-2 border-white/15 rounded-xl -rotate-12" />
                <div className="absolute top-1/3 left-1/4 w-3 h-3 bg-white/30 rounded-full" />
                <div className="absolute bottom-1/4 right-1/3 w-2 h-2 bg-white/40 rounded-full" />
                <div className="absolute top-16 left-16 w-10 h-[2px] bg-white/20 rotate-45" />
                <div className="absolute bottom-20 right-20 w-6 h-[2px] bg-white/15 -rotate-12" />

                {/* Glowing icon background */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/10 blur-2xl rounded-full scale-150" />
                    <div className="relative w-16 h-16 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-white/90" />
                    </div>
                  </div>
                </div>

                {/* Like counter - glass effect */}
                <div className="absolute top-4 right-4 bg-black/30 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1.5 border border-white/10">
                  <span className="text-emerald-300 text-sm">♥</span>
                  <span className="text-white text-sm font-medium">436</span>
                </div>

                {/* Play button with glow */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="pointer-events-auto w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 hover:scale-110 hover:shadow-xl hover:shadow-primary/50 transition-all duration-300 group-hover:scale-105 cursor-pointer">
                    <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                  </span>
                </div>
              </div>
              <div className="bg-card p-5">
                <h3 className="font-bold text-lg mb-1">
                  Shipping LLM Products
                </h3>
                <p className="text-sm text-muted-foreground">
                  Course • Code labs included
                </p>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
