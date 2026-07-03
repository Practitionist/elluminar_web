import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata = { title: "Dashboard" };

export default async function LearnDashboardPage() {
  const session = await requireUser("/learn");
  const userId = session.user.id;

  const [enrollments, projectInstances, upcomingSessions, credentials] = await Promise.all([
    db.enrollment.findMany({
      where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } },
      orderBy: { lastActivityAt: { sort: "desc", nulls: "last" } },
      take: 12,
      include: { course: { include: { tenant: { select: { displayName: true } } } }, cohort: true },
    }),
    db.projectInstance.findMany({
      where: { userId, status: { notIn: ["REFUNDED", "WITHDRAWN"] } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { project: true },
    }),
    db.liveSession.findMany({
      where: {
        status: "SCHEDULED",
        scheduledStartAt: { gte: new Date() },
        OR: [
          { cohort: { enrollments: { some: { userId, status: "ACTIVE" } } } },
          { projectInstance: { userId } },
        ],
      },
      orderBy: { scheduledStartAt: "asc" },
      take: 5,
      include: { course: { select: { title: true } } },
    }),
    db.credential.findMany({
      where: { userId, revokedAt: null },
      orderBy: { issuedAt: "desc" },
      take: 6,
    }),
  ]);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}
        </h1>
        <Button render={<Link href="/courses" />} variant="outline">
          Browse catalog
        </Button>
      </div>

      {upcomingSessions.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Upcoming live sessions</h2>
          <div className="mt-3 space-y-2">
            {upcomingSessions.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <span className="font-medium">{s.title}</span>
                    {s.course && (
                      <span className="text-muted-foreground"> · {s.course.title}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {s.scheduledStartAt.toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    {s.joinUrl ? (
                      <Button render={<a href={s.joinUrl} target="_blank" rel="noreferrer" />} size="sm">
                        Join
                      </Button>
                    ) : (
                      <Badge variant="outline">link on session day</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">Continue learning</h2>
        {enrollments.length === 0 ? (
          <Card className="mt-3">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nothing here yet —{" "}
              <Link href="/courses" className="font-medium text-foreground hover:underline">
                find your first course
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((e) => (
              <Link key={e.id} href={`/learn/courses/${e.courseId}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="line-clamp-2 text-base">{e.course.title}</CardTitle>
                    <CardDescription>
                      {e.course.tenant.displayName}
                      {e.cohort ? ` · ${e.cohort.name}` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Progress value={e.progressPct} className="h-2" />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {Math.round(e.progressPct)}%
                      </span>
                    </div>
                    {e.status === "COMPLETED" && (
                      <Badge className="mt-2" variant="secondary">
                        completed
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {projectInstances.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Your projects</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projectInstances.map((pi) => (
              <Link key={pi.id} href={`/learn/projects/${pi.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge>{pi.project.tier.toLowerCase()}</Badge>
                      <Badge variant="outline">
                        {pi.status.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <CardTitle className="mt-1 line-clamp-2 text-base">
                      {pi.project.title}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {credentials.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Your credentials</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {credentials.map((c) => (
              <Link key={c.id} href={`/verify/${c.verificationCode}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="py-4 text-sm">
                    <div className="font-medium">{c.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.kind.toLowerCase()} · {c.verificationCode}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
