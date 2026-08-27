import Link from "next/link";
import { ArrowRight, BookOpen, Cpu, Sparkles, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import type { HeroCard } from "@/lib/marketing/hero-cards";
import { getHeroShowcase } from "@/lib/marketing/hero-picks";
import { cn } from "@/lib/utils";

/**
 * One showcase slot: the gradient, the decorative geometry and the media
 * treatment stay fixed per position (the design), while the title, subtitle,
 * badge and href come from a real published catalog item (the data).
 */
type Slot = {
  cardClass: string;
  gradientClass: string;
  decor: React.ReactNode;
  media: React.ReactNode;
  control: React.ReactNode;
};

const SLOTS: Slot[] = [
  {
    cardClass: "shadow-xl hover:shadow-2xl",
    gradientClass: "bg-gradient-to-br from-rose-800 via-red-600 to-orange-500",
    decor: (
      <>
        <div className="absolute top-6 left-6 h-20 w-20 rotate-12 rounded-xl border-2 border-white/20" />
        <div className="absolute right-8 bottom-12 h-16 w-16 rounded-full border-2 border-white/15" />
        <div className="absolute top-1/4 right-1/4 h-3 w-3 rounded-full bg-white/30" />
        <div className="absolute bottom-1/3 left-1/4 h-2 w-2 rounded-full bg-white/40" />
        <div className="absolute top-1/2 right-12 h-[2px] w-8 rotate-45 bg-white/20" />
      </>
    ),
    media: (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 scale-150 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm">
            <BookOpen className="h-8 w-8 text-white/90" />
          </div>
        </div>
      </div>
    ),
    control: <PlayAffordance />,
  },
  {
    // Featured centre slot.
    cardClass:
      "shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] md:scale-105 md:-translate-y-1 ring-2 ring-primary/20",
    gradientClass: "bg-gradient-to-br from-violet-800 via-fuchsia-600 to-orange-500",
    decor: (
      <>
        <div className="absolute top-8 left-8 h-24 w-24 -rotate-6 rounded-2xl border-2 border-white/15" />
        <div className="absolute top-12 left-12 h-16 w-16 rotate-12 rounded-xl border border-white/10" />
        <div className="absolute right-6 bottom-16 h-12 w-12 rounded-full border-2 border-white/20" />
        <div className="absolute right-10 bottom-20 h-6 w-6 rounded-full bg-white/15" />
        <div className="absolute top-1/3 right-1/3 h-4 w-4 rounded-full bg-white/20 blur-sm" />
        <div className="absolute bottom-1/4 left-1/3 h-3 w-3 rounded-full bg-white/30" />
        <div className="absolute top-20 right-16 h-[2px] w-12 -rotate-45 bg-white/20" />
        <div className="absolute bottom-24 left-16 h-[2px] w-8 rotate-12 bg-white/15" />
      </>
    ),
    media: (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 scale-[2] rounded-full bg-white/15 blur-3xl" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/25 bg-white/15 shadow-lg backdrop-blur-sm">
            <Cpu className="h-10 w-10 text-white" />
          </div>
        </div>
      </div>
    ),
    control: (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-xl shadow-black/20 transition-all duration-300 group-hover:scale-105">
          <span className="flex gap-1">
            <span className="h-5 w-1.5 rounded-full bg-gray-800" />
            <span className="h-5 w-1.5 rounded-full bg-gray-800" />
          </span>
        </span>
      </div>
    ),
  },
  {
    cardClass: "shadow-xl hover:shadow-2xl",
    gradientClass: "bg-gradient-to-br from-teal-800 via-emerald-600 to-cyan-500",
    decor: (
      <>
        <div className="absolute top-8 right-8 h-16 w-16 rounded-full border-2 border-white/20" />
        <div className="absolute top-10 right-10 h-8 w-8 rounded-full border border-white/15" />
        <div className="absolute bottom-12 left-8 h-20 w-20 -rotate-12 rounded-xl border-2 border-white/15" />
        <div className="absolute top-1/3 left-1/4 h-3 w-3 rounded-full bg-white/30" />
        <div className="absolute right-1/3 bottom-1/4 h-2 w-2 rounded-full bg-white/40" />
        <div className="absolute top-16 left-16 h-[2px] w-10 rotate-45 bg-white/20" />
        <div className="absolute right-20 bottom-20 h-[2px] w-6 -rotate-12 bg-white/15" />
      </>
    ),
    media: (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 scale-150 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm">
            <Sparkles className="h-8 w-8 text-white/90" />
          </div>
        </div>
      </div>
    ),
    control: <PlayAffordance />,
  },
];

function PlayAffordance() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span className="bg-primary shadow-primary/40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 group-hover:scale-105">
        <Play className="ml-0.5 h-5 w-5 text-white" fill="white" />
      </span>
    </div>
  );
}

function ShowcaseCard({ card, slot }: { card: HeroCard; slot: Slot }) {
  return (
    <Link
      href={card.href}
      className={cn(
        "group focus-visible:ring-primary relative block overflow-hidden rounded-2xl transition-all duration-500 hover:-translate-y-3 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        slot.cardClass,
      )}
    >
      <div className={cn("relative aspect-[4/3] overflow-hidden", slot.gradientClass)}>
        {slot.decor}
        {slot.media}

        {/* Factual catalog attribute (level / duration) — never a like count. */}
        {card.badge ? (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 backdrop-blur-md">
            <span className="text-sm font-medium text-white">{card.badge}</span>
          </div>
        ) : null}

        {slot.control}
      </div>
      <div className="bg-card p-5">
        <h2 className="mb-1 text-lg font-bold">{card.title}</h2>
        <p className="text-muted-foreground text-sm">{card.subtitle}</p>
      </div>
    </Link>
  );
}

/** Grid + slot assignment degrade cleanly when the catalog has fewer items. */
function slotsFor(count: number): Slot[] {
  if (count >= 3) return SLOTS;
  // Below three, skip the featured centre treatment so nothing looks lopsided.
  if (count === 2) return [SLOTS[0], SLOTS[2]];
  return [SLOTS[0]];
}

const GRID_BY_COUNT: Record<number, string> = {
  1: "max-w-sm",
  2: "md:grid-cols-2 max-w-4xl",
  3: "md:grid-cols-3 max-w-6xl",
};

export async function HeroSection() {
  // Real published catalog items. Empty (fresh/unseeded/unreachable database)
  // simply renders the hero without the showcase row.
  const cards = await getHeroShowcase();
  const slots = slotsFor(cards.length);

  return (
    <section className="to-background relative w-full overflow-hidden bg-gradient-to-b from-pink-50/50 via-purple-50/30 py-12 md:py-24 lg:py-32">
      {/* Decorative pink diagonal ribbons */}
      <div className="from-primary/20 pointer-events-none absolute top-1/4 left-0 h-32 w-64 -translate-x-32 -rotate-12 transform bg-gradient-to-r to-purple-500/20" />
      <div className="from-primary/20 pointer-events-none absolute top-1/3 right-0 h-32 w-64 translate-x-32 rotate-12 transform bg-gradient-to-r to-purple-500/20" />

      <div className="relative container px-4 md:px-6">
        <FadeIn direction="up" delay={0.1}>
          {/* Centered Hero Content */}
          <div
            className={cn(
              "flex flex-col items-center space-y-8 text-center",
              cards.length > 0 && "mb-16",
            )}
          >
            <div className="max-w-4xl space-y-6">
              <div className="inline-block">
                <span className="bg-primary/10 text-primary border-primary/20 inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Courses · Live cohorts · Mentor-reviewed projects
                </span>
              </div>

              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none">
                <span className="from-primary to-primary text-primary gradient-clip bg-gradient-to-r via-purple-600 bg-clip-text">
                  Learn by Building
                </span>
                <br />
                Prove It with Mentors
              </h1>

              <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed md:text-xl">
                A marketplace where technical creators teach, real mentors review your projects, and
                your portfolio carries proof — not just certificates. Buy exactly what you need, à
                la carte.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Button
                render={<Link href="/projects" />}
                size="lg"
                variant="outline"
                className="rounded-full border-2 bg-black px-8 text-base text-white hover:bg-black/90 hover:text-white"
              >
                Browse Projects
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                render={<Link href="/courses" />}
                size="lg"
                className="rounded-full px-8 text-base shadow-lg hover:shadow-xl"
              >
                Browse Courses
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Showcase cards — real published courses and projects. */}
          {cards.length > 0 ? (
            <div
              className={cn(
                "relative mx-auto grid grid-cols-1 gap-6",
                GRID_BY_COUNT[cards.length] ?? "max-w-6xl md:grid-cols-3",
              )}
            >
              {cards.map((card, i) => (
                <ShowcaseCard key={card.key} card={card} slot={slots[i]} />
              ))}
            </div>
          ) : null}
        </FadeIn>
      </div>
    </section>
  );
}
