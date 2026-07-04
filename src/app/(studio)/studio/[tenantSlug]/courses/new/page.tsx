import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { NewCourseForm } from "./new-course-form";

export const metadata = { title: "New course" };

export default async function NewCoursePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  await requireTenantMember(tenantSlug, ["owner", "admin", "instructor"]);
  const categories = await db.category.findMany({ orderBy: { sort: "asc" } });

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        New course
      </h1>
      <NewCourseForm
        tenantSlug={tenantSlug}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
