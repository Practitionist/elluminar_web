import { requireTenantMember } from "@/lib/auth/session";

import { NewProjectForm } from "./new-project-form";

export const metadata = { title: "New project" };

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  await requireTenantMember(tenantSlug, ["owner", "admin", "instructor"]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New mentor-guided project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Write an ambiguous, real-world brief — the kind of take-home a serious
          company would send. A default rubric and three mentor checkpoints are
          created for you to refine.
        </p>
      </div>
      <NewProjectForm tenantSlug={tenantSlug} />
    </div>
  );
}
