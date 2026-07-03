import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PILLARS = [
  {
    title: "Courses that go deep",
    description:
      "Recorded and live-cohort courses from independent technical creators — with embedded code labs, quizzes, and real assignments.",
  },
  {
    title: "Projects that prove it",
    description:
      "Buy a single mentor-reviewed project at take-home-assessment scale. Rubric-graded checkpoints, revision loops, and a verifiable credential.",
  },
  {
    title: "À la carte, always",
    description:
      "No forced bundles, no bootcamp-scale commitment. One cart for exactly what you need — with a clear 14-day refund window.",
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto w-full max-w-6xl px-4 py-24 text-center">
        <Badge variant="outline" className="mb-4">
          Courses · Live cohorts · Mentor-reviewed projects
        </Badge>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Learn by building. Prove it with mentor-verified work.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          A marketplace where technical creators teach, real mentors review your
          projects, and your portfolio carries proof — not just certificates.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button render={<Link href="/courses" />} size="lg">
            Browse courses
          </Button>
          <Button render={<Link href="/projects" />} size="lg" variant="outline">
            Explore projects
          </Button>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-16 md:grid-cols-3">
          {PILLARS.map((p) => (
            <Card key={p.title}>
              <CardHeader>
                <CardTitle>{p.title}</CardTitle>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center md:flex-row md:justify-between md:text-left">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Teach without becoming a software company
              </h2>
              <p className="mt-1 max-w-xl text-muted-foreground">
                Branded storefront, video with DRM, live classes, code labs,
                payments, and payouts — you bring the curriculum.
              </p>
            </div>
            <Button render={<Link href="/onboarding" />} size="lg">
              Become a creator
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
