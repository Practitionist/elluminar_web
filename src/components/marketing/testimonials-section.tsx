"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Star, User } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

const testimonials = [
  {
    name: "Priya Sharma",
    role: "Backend Engineer",
    testimonial:
      "I've tried several platforms before, but this is by far the best. The mentor-reviewed projects feel like real take-home assessments — the revision loops taught me more than any video course ever did.",
    highlighted: true,
  },
  {
    name: "Rahul Verma",
    role: "Career Switcher",
    testimonial:
      "Being able to buy a single project instead of committing to a bootcamp was exactly what I needed. I finished my first mentor-reviewed project in a few weeks and the verified credential went straight on my portfolio.",
    highlighted: false,
  },
  {
    name: "Ananya Reddy",
    role: "Engineering Graduate",
    testimonial:
      "As a busy professional, I needed something à la carte. The embedded code labs make courses genuinely hands-on, and mentor feedback on my submissions has been fantastic. It's a game-changer!",
    highlighted: false,
  },
];

export function TestimonialsSection() {
  return (
    <section className="w-full py-16 md:py-28 lg:py-36 relative overflow-hidden bg-muted/30">
      <div className="container px-4 md:px-6 relative">
        <FadeIn direction="up" delay={0.1}>
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
            <div className="space-y-5">
              <div className="inline-block">
                <span className="inline-flex items-center text-sm font-semibold text-primary uppercase tracking-wider bg-primary/10 px-4 py-1.5 rounded-full">
                  <Star className="w-4 h-4 mr-2" />
                  Testimonials
                </span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl max-w-3xl mx-auto">
                See What They <span className="text-gradient">Are Saying!</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Learners who build real projects and prove it with
                mentor-verified work.
              </p>
            </div>
          </div>

          {/* Testimonial Cards with Navigation */}
          <div className="relative max-w-6xl mx-auto">
            {/* Navigation Arrows - Positioned on sides */}
            <div className="hidden md:block">
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16 rounded-full bg-card shadow-md hover:bg-card/80 border border-border/50 z-10 transition-all hover:scale-105"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-16 rounded-full bg-card shadow-md hover:bg-card/80 border border-border/50 z-10 transition-all hover:scale-105"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, index) => (
                <Card
                  key={index}
                  className={`hover:shadow-xl transition-all duration-500 hover:-translate-y-2 backdrop-blur-sm ${
                    testimonial.highlighted
                      ? "border-2 border-primary/30 shadow-lg rounded-3xl bg-card glow-primary"
                      : "border border-border/50 rounded-2xl bg-card/80 hover:border-primary/20"
                  }`}
                >
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/25 to-purple-500/20 flex items-center justify-center overflow-hidden flex-shrink-0 border border-primary/20">
                        <User className="w-7 h-7 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-base">
                          {testimonial.name}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {testimonial.role}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      &ldquo;{testimonial.testimonial}&rdquo;
                    </p>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className="w-4 h-4 fill-primary text-primary"
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Mobile Navigation Arrows */}
            <div className="flex md:hidden justify-center gap-4 mt-8">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-border/50 hover:border-primary/30"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-border/50 hover:border-primary/30"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
