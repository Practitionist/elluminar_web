import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";

import { CourseReviewButtons } from "./course-review-buttons";

export const metadata = { title: "Catalog moderation" };

export default async function ModerationPage() {
  const courses = await db.course.findMany({
    where: { status: "IN_REVIEW" },
    orderBy: { updatedAt: "asc" },
    include: {
      tenant: { select: { displayName: true, slug: true } },
      _count: { select: { lessons: true } },
      prices: { where: { active: true, currency: "INR", cohortId: null } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Catalog moderation</h1>
      {courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing awaiting review.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Lessons</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="text-right">Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium">{c.title}</div>
                  <Badge variant="outline">{c.level.toLowerCase()}</Badge>
                </TableCell>
                <TableCell>
                  <div>{c.tenant.displayName}</div>
                  <div className="text-xs text-muted-foreground">/c/{c.tenant.slug}</div>
                </TableCell>
                <TableCell>{c._count.lessons}</TableCell>
                <TableCell>
                  {c.prices[0]
                    ? `₹${(Number(c.prices[0].amountMinor) / 100).toLocaleString("en-IN")}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <CourseReviewButtons courseId={c.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
