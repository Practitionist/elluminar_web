"use client";

import { Card } from "@/components/ui/card";
import { User } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

const creators = [
  { name: "Priya Singh", year: "2020" },
  { name: "Ausy Mariene", year: "2020" },
  { name: "Rajesh", year: "2019" },
  { name: "Sarah Wiston", year: "2019" },
  { name: "Mayleen Niu", year: "2017" },
  { name: "Alex Vilel", year: "2020" },
  { name: "Bancroft Bart", year: "2018" },
  { name: "Baylee Bee", year: "2024" },
  { name: "Mike Chen", year: "2021" },
  { name: "Elizabeth", year: "2018" },
  { name: "Dionna De", year: "2021" },
];

function CreatorCard({
  name,
  year,
  size = "md",
}: {
  name: string;
  year: string;
  size?: "sm" | "md";
}) {
  const isSmall = size === "sm";
  return (
    <Card className="rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 h-full">
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <User
          className={`${isSmall ? "w-16 h-16" : "w-20 h-20"} text-primary/40 absolute`}
        />
        <div
          className={`absolute ${isSmall ? "bottom-3 left-3 right-3" : "bottom-4 left-4 right-4"}`}
        >
          <h4
            className={`font-bold text-primary ${isSmall ? "text-base" : "text-lg"}`}
          >
            {name}
          </h4>
          <p className="text-xs text-muted-foreground">Since {year}</p>
        </div>
      </div>
    </Card>
  );
}

export function SocialProofSection() {
  return (
    <section className="w-full py-16 md:py-28 lg:py-36 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh opacity-30" />

      <div className="container px-4 md:px-6 relative">
        <FadeIn direction="up" delay={0.1}>
          {/* Header */}
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
            <div className="space-y-5">
              <div className="inline-block">
                <span className="inline-flex items-center text-sm font-semibold text-primary uppercase tracking-wider bg-primary/10 px-4 py-1.5 rounded-full">
                  Community
                </span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl max-w-3xl mx-auto">
                Teach Without Becoming
                <br />
                <span className="text-gradient">A Software Company.</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                Branded storefront, DRM video, live classes, code labs,
                payments, and payouts — you bring the curriculum.
              </p>
            </div>
          </div>

          {/* Bento Grid Layout */}
          <div className="max-w-7xl mx-auto">
            {/* Desktop Layout */}
            <div className="hidden lg:grid grid-cols-12 grid-rows-4 gap-4 min-h-[800px]">
              {/* Row 1 */}
              <div className="col-span-3 row-span-1">
                <CreatorCard name={creators[0].name} year={creators[0].year} />
              </div>
              <div className="col-span-6 row-span-1 flex items-center justify-center">
                <div className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight">
                  200+
                </div>
              </div>
              <div className="col-span-3 row-span-1">
                <CreatorCard name={creators[1].name} year={creators[1].year} />
              </div>

              {/* Row 2 */}
              <div className="col-span-2 row-span-1">
                <CreatorCard
                  name={creators[2].name}
                  year={creators[2].year}
                  size="sm"
                />
              </div>
              <div className="col-span-3 row-span-1">
                <CreatorCard name={creators[3].name} year={creators[3].year} />
              </div>
              <div className="col-span-4 row-span-1 flex items-center justify-center">
                <div className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
                  Creators
                </div>
              </div>
              <div className="col-span-3 row-span-1">
                <CreatorCard name={creators[4].name} year={creators[4].year} />
              </div>

              {/* Row 3 */}
              <div className="col-span-3 row-span-1">
                <CreatorCard name={creators[5].name} year={creators[5].year} />
              </div>
              <div className="col-span-4 row-span-1 flex items-center justify-center">
                <div className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
                  Choose
                </div>
              </div>
              <div className="col-span-3 row-span-1">
                <CreatorCard name={creators[6].name} year={creators[6].year} />
              </div>
              <div className="col-span-2 row-span-1">
                <CreatorCard
                  name={creators[7].name}
                  year={creators[7].year}
                  size="sm"
                />
              </div>

              {/* Row 4 */}
              <div className="col-span-2 row-span-1">
                <CreatorCard
                  name={creators[8].name}
                  year={creators[8].year}
                  size="sm"
                />
              </div>
              <div className="col-span-3 row-span-1">
                <CreatorCard name={creators[9].name} year={creators[9].year} />
              </div>
              <div className="col-span-5 row-span-1 flex items-center justify-center">
                <div className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
                  lms-web
                </div>
              </div>
              <div className="col-span-2 row-span-1">
                <CreatorCard
                  name={creators[10].name}
                  year={creators[10].year}
                  size="sm"
                />
              </div>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden grid grid-cols-2 gap-4">
              {creators.slice(0, 4).map((creator, index) => (
                <Card
                  key={index}
                  className="h-48 hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900"
                >
                  <div className="relative w-full h-full">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <User className="w-16 h-16 text-primary/40" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h4 className="font-bold text-primary text-sm">
                        {creator.name}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Since {creator.year}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Mobile Text */}
            <div className="lg:hidden mt-8 text-center space-y-4">
              <div className="text-5xl font-bold">200+</div>
              <div className="text-3xl font-bold">Creators</div>
              <div className="text-3xl font-bold">Choose</div>
              <div className="text-3xl font-bold">lms-web</div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
