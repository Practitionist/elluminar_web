import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata = { title: "My projects" };

export default async function MyProjectsPage() {
  const session = await requireUser("/learn/projects");
  const instances = await db.projectInstance.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { project: { include: { tenant: { select: { displayName: true } } } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">My projects</h1>
        <Button render={<Link href="/projects" />} variant="outline">
          Browse projects
        </Button>
      </div>
      {instances.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No projects yet — buy a mentor-reviewed project to build real proof of work.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {instances.map((pi) => (
            <Link key={pi.id} href={`/learn/projects/${pi.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge>{pi.project.tier.toLowerCase()}</Badge>
                    <Badge variant="outline">{pi.status.toLowerCase().replace(/_/g, " ")}</Badge>
                  </div>
                  <CardTitle className="mt-1 line-clamp-2 text-base">
                    {pi.project.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {pi.project.tenant.displayName}
                    {pi.dueAt
                      ? ` · due ${pi.dueAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`
                      : ""}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
