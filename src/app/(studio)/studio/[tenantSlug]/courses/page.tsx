import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Courses" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  PUBLISHED: "default",
  IN_REVIEW: "secondary",
  DRAFT: "outline",
};

export default async function StudioCoursesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug);

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
        <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
        <Button render={<Link href={`/studio/${tenantSlug}/courses/new`} />}>
          New course
        </Button>
      </div>
      {courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No courses yet — create your first one.
        </p>
      ) : (
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
                    className="font-medium hover:underline"
                  >
                    {c.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">/{c.slug}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>
                    {c.status.toLowerCase().replace("_", " ")}
                  </Badge>
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
      )}
    </div>
  );
}
