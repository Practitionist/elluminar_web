import Link from "next/link";
import { redirect } from "next/navigation";

import { Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata = { title: "Studio" };

export default async function StudioIndexPage() {
  const session = await requireUser("/studio");

  const memberships = await db.member.findMany({
    where: { userId: session.user.id },
    select: {
      role: true,
      organization: {
        select: { tenant: { select: { slug: true, displayName: true, status: true, type: true } } },
      },
    },
  });
  const tenants = memberships
    .map((m) => ({ role: m.role, tenant: m.organization.tenant }))
    .filter((t): t is { role: string; tenant: NonNullable<typeof t.tenant> } => !!t.tenant);

  if (tenants.length === 0) redirect("/onboarding");
  if (tenants.length === 1) redirect(`/studio/${tenants[0].tenant.slug}`);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        Your schools
      </h1>
      <div className="mt-6 grid gap-4">
        {tenants.map(({ role, tenant }) => (
          <Link
            key={tenant.slug}
            href={`/studio/${tenant.slug}`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-muted/50"
          >
            <div>
              <div className="text-base font-extrabold">{tenant.displayName}</div>
              <div className="mt-1 text-xs font-semibold text-muted-foreground">
                /c/{tenant.slug}
              </div>
            </div>
            <div className="flex gap-2">
              <Pill tone="neutral">{role}</Pill>
              <Pill tone={tenant.status === "APPROVED" ? "success" : "distinction"}>
                {tenant.status.toLowerCase()}
              </Pill>
            </div>
          </Link>
        ))}
      </div>
      <Button
        render={<Link href="/onboarding?new=1" />}
        variant="outline"
        className="mt-6 rounded-full"
      >
        Create another school
      </Button>
    </div>
  );
}
