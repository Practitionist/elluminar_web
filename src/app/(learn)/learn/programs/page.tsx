import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata = { title: "My programs" };

export default async function MyProgramsPage() {
  const session = await requireUser("/learn/programs");

  const enrollments = await db.programEnrollment.findMany({
    where: { userId: session.user.id },
    orderBy: { enrolledAt: "desc" },
    include: {
      programCohort: {
        include: {
          program: {
            include: {
              ownerTenant: { select: { displayName: true } },
              items: { select: { required: true } },
            },
          },
        },
      },
      credentials: { select: { verificationCode: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">My programs</h1>
      {enrollments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No programs yet — programs are assigned by your company or
            university once you&apos;re rostered.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {enrollments.map((pe) => (
            <Link key={pe.id} href={`/learn/programs/${pe.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge variant={pe.status === "COMPLETED" ? "default" : "outline"}>
                      {pe.status.toLowerCase().replace("_", " ")}
                    </Badge>
                    {pe.credentials[0] && <Badge variant="secondary">certified 🎓</Badge>}
                  </div>
                  <CardTitle className="mt-1 line-clamp-2 text-base">
                    {pe.programCohort.program.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {pe.programCohort.program.ownerTenant.displayName} ·{" "}
                    {pe.programCohort.name} ·{" "}
                    {pe.programCohort.program.items.length} items
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
