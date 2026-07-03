"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Crown, Lightbulb, Users } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

export function PremiumFeaturesSection() {
  return (
    <section className="w-full py-16 md:py-28 lg:py-36 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-30" />

      <div className="container px-4 md:px-6 relative">
        <FadeIn direction="up" delay={0.2}>
          <div className="space-y-12">
            {/* Header */}
            <div className="text-center space-y-5">
              <div className="inline-flex items-center rounded-full bg-yellow-500/10 px-4 py-1.5 text-sm font-medium text-yellow-600 dark:text-yellow-500 border border-yellow-500/20">
                <Crown className="w-4 h-4 mr-2" />
                Membership
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Go Further with a <span className="text-gradient">Membership</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Memberships add breadth and guided support — they never gate a
                single purchase
              </p>
            </div>

            {/* Premium Features Grid */}
            <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
              <Card className="rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-purple-500/5 to-card glow-primary hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-purple-500/20 border border-primary/30">
                      <Users className="h-7 w-7 text-primary" />
                    </div>
                    <CardTitle className="text-xl">
                      Guided Mentorship
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    Get priority mentor matching and monthly Sprint project
                    credits. Mentors review your submissions, run revision
                    loops, and help you grow problem-solving skills without
                    giving away solutions.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-purple-500/5 to-card glow-primary hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-purple-500/20 border border-primary/30">
                      <Lightbulb className="h-7 w-7 text-primary" />
                    </div>
                    <CardTitle className="text-xl">Career Outcomes</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    Build a verified proof-of-work portfolio, become visible to
                    hiring partners, and get placement support — with live
                    cohorts, capstone discounts, and priority seats included.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* CTA */}
            <div className="flex justify-center pt-4">
              <Button
                render={<Link href="/pricing" />}
                size="lg"
                className="px-10 rounded-full shadow-lg hover:shadow-xl glow-primary transition-all duration-300 group"
              >
                Explore Membership Plans
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
