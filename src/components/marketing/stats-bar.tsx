"use client";

import { Star } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

const stats = [
  { value: "500+", label: "Courses & projects" },
  { value: "200+", label: "Creators teaching" },
  { value: "10K+", label: "Mentor reviews" },
];

export function StatsBar() {
  return (
    <section className="w-full py-10 md:py-12 relative overflow-hidden">
      {/* Smooth gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-purple-600/95 via-50% to-primary" />

      <div className="container px-4 md:px-6 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center">
          {stats.map((stat, index) => (
            <FadeIn key={stat.label} direction="up" delay={0.1 * (index + 1)}>
              <div className="space-y-2 group">
                <div className="text-3xl md:text-5xl font-bold text-white tracking-tight group-hover:scale-105 transition-transform">
                  {stat.value}
                </div>
                <div className="text-sm md:text-base text-white/80 font-medium">
                  {stat.label}
                </div>
              </div>
            </FadeIn>
          ))}
          <FadeIn direction="up" delay={0.4}>
            <div className="space-y-2 group">
              <div className="flex items-center justify-center gap-2 group-hover:scale-105 transition-transform">
                <div className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                  4.9
                </div>
                <Star className="h-6 w-6 md:h-8 md:w-8 fill-white text-white" />
              </div>
              <div className="text-sm md:text-base text-white/80 font-medium">
                Average rating
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
