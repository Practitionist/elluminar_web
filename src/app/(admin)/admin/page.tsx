import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";

export const metadata = { title: "Admin" };

export default async function AdminDashboardPage() {
  const [pendingTenants, pendingMentors, coursesInReview, users] = await Promise.all([
    db.tenant.count({ where: { status: { in: ["APPLIED", "IN_REVIEW"] } } }),
    db.mentorProfile.count({ where: { status: { in: ["APPLIED", "IN_REVIEW"] } } }),
    db.course.count({ where: { status: "IN_REVIEW" } }),
    db.user.count(),
  ]);

  const stats = [
    { label: "Tenant applications", value: pendingTenants },
    { label: "Mentor applications", value: pendingMentors },
    { label: "Courses in review", value: coursesInReview },
    { label: "Total users", value: users },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
