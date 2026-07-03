import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <h1 className="text-2xl font-semibold tracking-tight">Your schools</h1>
      <div className="mt-6 grid gap-4">
        {tenants.map(({ role, tenant }) => (
          <Link key={tenant.slug} href={`/studio/${tenant.slug}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">{tenant.displayName}</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline">{role}</Badge>
                  <Badge variant={tenant.status === "APPROVED" ? "default" : "secondary"}>
                    {tenant.status.toLowerCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                /c/{tenant.slug}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Button render={<Link href="/onboarding" />} variant="outline" className="mt-6">
        Create another school
      </Button>
    </div>
  );
}
