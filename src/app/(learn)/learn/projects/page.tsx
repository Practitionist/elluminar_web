import Link from "next/link";

import { Pill, type PillTone } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata = { title: "My projects" };

const PROJECT_STATUS_TONE: Record<string, PillTone> = {
  PENDING_KICKOFF: "neutral",
  IN_PROGRESS: "info",
  IN_REVIEW: "info",
  CHANGES_REQUESTED: "distinction",
  DEFENSE_PENDING: "distinction",
  PASSED: "success",
  FAILED: "destructive",
  WITHDRAWN: "neutral",
  REFUNDED: "neutral",
};

export default async function MyProjectsPage() {
  const session = await requireUser("/learn/projects");
  const instances = await db.projectInstance.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { project: { include: { tenant: { select: { displayName: true } } } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          My projects
        </h1>
        <Button render={<Link href="/projects" />} variant="outline" className="rounded-full">
          Browse projects
        </Button>
      </div>
      {instances.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          No projects yet — buy a mentor-reviewed project to build real proof of work.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {instances.map((pi) => (
            <Link
              key={pi.id}
              href={`/learn/projects/${pi.id}`}
              className="rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <Pill tone="distinction">{pi.project.tier.toLowerCase()}</Pill>
                <Pill tone={PROJECT_STATUS_TONE[pi.status] ?? "neutral"}>
                  {pi.status.toLowerCase().replace(/_/g, " ")}
                </Pill>
              </div>
              <div className="mt-2 line-clamp-2 text-base font-extrabold">
                {pi.project.title}
              </div>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {pi.project.tenant.displayName}
                {pi.dueAt
                  ? ` · due ${pi.dueAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`
                  : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
