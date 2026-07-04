import { Pill } from "@/components/shared";
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
import { ProjectReviewButtons } from "./project-review-buttons";

export const metadata = { title: "Catalog moderation" };

export default async function ModerationPage() {
  const [courses, projects] = await Promise.all([
    db.course.findMany({
      where: { status: "IN_REVIEW" },
      orderBy: { updatedAt: "asc" },
      include: {
        tenant: { select: { displayName: true, slug: true } },
        _count: { select: { lessons: true } },
        prices: { where: { active: true, currency: "INR", cohortId: null } },
      },
    }),
    db.project.findMany({
      where: { status: "IN_REVIEW" },
      orderBy: { updatedAt: "asc" },
      include: {
        tenant: { select: { displayName: true, slug: true } },
        _count: { select: { milestones: true } },
        prices: { where: { active: true, currency: "INR", mentorLevel: null } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        Catalog moderation
      </h1>

      <section>
        <h2 className="mb-3 text-base font-extrabold">Courses</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing awaiting review.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                    Course
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                    School
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                    Lessons
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                    Price
                  </TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">
                    Decision
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => (
                  <TableRow key={c.id} className="border-t border-border">
                    <TableCell>
                      <div className="font-medium">{c.title}</div>
                      <Pill tone="primary">{c.level.toLowerCase()}</Pill>
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
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-extrabold">Projects</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing awaiting review.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                    Project
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                    School
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                    Milestones
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                    Price
                  </TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">
                    Decision
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id} className="border-t border-border">
                    <TableCell>
                      <div className="font-medium">{p.title}</div>
                      <Pill tone="distinction">{p.tier.toLowerCase()}</Pill>
                    </TableCell>
                    <TableCell>
                      <div>{p.tenant.displayName}</div>
                      <div className="text-xs text-muted-foreground">/c/{p.tenant.slug}</div>
                    </TableCell>
                    <TableCell>{p._count.milestones}</TableCell>
                    <TableCell>
                      {p.prices[0]
                        ? `₹${(Number(p.prices[0].amountMinor) / 100).toLocaleString("en-IN")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <ProjectReviewButtons projectId={p.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
