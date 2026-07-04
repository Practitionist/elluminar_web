"use client";

import { ShieldCheck } from "lucide-react";

import { CredentialProofCard, SectionEyebrow } from "@/components/shared";
import { FadeIn } from "@/components/ui/fade-in";

// Illustrative — swap for real hiring partners / verified employers.
const LOGOS = ["Zerodha", "Razorpay", "CRED", "Swiggy", "Meesho", "+140 teams"];

export function CredentialCenterpieceSection() {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-background to-muted/40 py-16 md:py-24">
      <div className="container px-4 md:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <FadeIn direction="right">
            <div className="max-w-xl space-y-6">
              <SectionEyebrow icon={<ShieldCheck className="size-4" />}>
                The proof
              </SectionEyebrow>
              <h2 className="font-display text-3xl leading-[1.08] font-medium tracking-tight text-balance sm:text-4xl md:text-5xl">
                A résumé says you can.
                <br />A <span className="text-primary italic">proof</span> shows
                you did.
              </h2>
              <p className="text-lg leading-relaxed text-muted-foreground">
                Finish a mentor-reviewed project, defend it live, and earn a
                credential anyone can verify in ten seconds — rubric scores,
                reviewer seniority, and the defense recording, all in one link.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
                <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  Credentials accepted at
                </span>
                {LOGOS.map((l) => (
                  <span
                    key={l}
                    className="text-sm font-extrabold text-muted-foreground/55"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </FadeIn>
          <FadeIn direction="left" delay={0.1}>
            <CredentialProofCard />
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
