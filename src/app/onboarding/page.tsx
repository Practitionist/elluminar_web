import { redirect } from "next/navigation";

import { SectionEyebrow } from "@/components/shared";
import { BRAND } from "@/lib/brand";
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
      <SectionEyebrow tone="primary">Get started</SectionEyebrow>
      <h1 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
        Bring your organization to {BRAND.name}
      </h1>
      <p className="mt-3 text-muted-foreground">
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
