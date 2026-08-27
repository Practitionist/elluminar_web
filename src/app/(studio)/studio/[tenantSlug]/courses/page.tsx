import Link from "next/link";

import { Pill, type PillTone } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireStudioTenant } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Courses" };

const STATUS_TONE: Record<string, PillTone> = {
  PUBLISHED: "success",
  IN_REVIEW: "distinction",
  DRAFT: "neutral",
};

export default async function StudioCoursesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireStudioTenant(tenantSlug);

  const courses = await db.course.findMany({
    where: { tenantId: tenant.id },
    orderBy: { updatedAt: "desc" },
    include: {
      prices: { where: { active: true, currency: "INR", region: null, cohortId: null } },
      _count: { select: { lessons: true, enrollments: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Courses
        </h1>
        <Button
          render={<Link href={`/studio/${tenantSlug}/courses/new`} />}
          className="rounded-full"
        >
          New course
        </Button>
      </div>
      {courses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No courses yet — create your first one.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lessons</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/studio/${tenantSlug}/courses/${c.id}`}
                      className="font-bold hover:underline"
                    >
                      {c.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">/{c.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Pill tone={STATUS_TONE[c.status] ?? "neutral"}>
                      {c.status.toLowerCase().replace("_", " ")}
                    </Pill>
                  </TableCell>
                  <TableCell>{c._count.lessons}</TableCell>
                  <TableCell>{c._count.enrollments}</TableCell>
                  <TableCell>
                    {c.prices[0] ? formatMoney(c.prices[0].amountMinor) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
