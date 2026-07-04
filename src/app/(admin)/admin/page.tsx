import { StatCard } from "@/components/dashboard/stat-card";
import type { PillTone } from "@/components/shared";
import { db } from "@/lib/db";

export const metadata = { title: "Admin" };

export default async function AdminDashboardPage() {
  const [pendingTenants, pendingMentors, coursesInReview, users] =
    await Promise.all([
      db.tenant.count({ where: { status: { in: ["APPLIED", "IN_REVIEW"] } } }),
      db.mentorProfile.count({
        where: { status: { in: ["APPLIED", "IN_REVIEW"] } },
      }),
      db.course.count({ where: { status: "IN_REVIEW" } }),
      db.user.count(),
    ]);

  const stats: {
    label: string;
    value: number;
    icon: string;
    tone: PillTone;
  }[] = [
    {
      label: "Tenant applications",
      value: pendingTenants,
      icon: "tenants",
      tone: "distinction",
    },
    {
      label: "Mentor applications",
      value: pendingMentors,
      icon: "mentor",
      tone: "info",
    },
    {
      label: "Courses in review",
      value: coursesInReview,
      icon: "moderation",
      tone: "primary",
    },
    { label: "Total users", value: users, icon: "community", tone: "success" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Platform overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Queues waiting on you across the marketplace.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>
    </div>
  );
}
