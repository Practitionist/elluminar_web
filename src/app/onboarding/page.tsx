import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { OrganizationApplicationForm } from "./organization-application-form";

export const metadata = { title: "Create your organization" };

export default async function OnboardingPage() {
  const session = await requireUser("/onboarding");

  // Already in an org? Route to its home surface instead.
  const membership = await db.member.findFirst({
    where: { userId: session.user.id },
    select: {
      organization: { select: { tenant: { select: { slug: true, type: true } } } },
    },
  });
  const tenant = membership?.organization.tenant;
  if (tenant) {
    redirect(tenant.type === "CREATOR" ? `/studio/${tenant.slug}` : `/org/${tenant.slug}`);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Bring your organization to lms-web
      </h1>
      <p className="mt-2 text-muted-foreground">
        Creators get a storefront and authoring studio. Companies and
        universities get licensing, rosters, programs, and reporting — all on
        the same account you already have.
      </p>
      <div className="mt-8">
        <OrganizationApplicationForm />
      </div>
    </div>
  );
}
