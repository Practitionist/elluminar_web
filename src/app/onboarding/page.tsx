import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { CreatorApplicationForm } from "./creator-application-form";

export const metadata = { title: "Become a creator" };

export default async function OnboardingPage() {
  const session = await requireUser("/onboarding");

  // Already a member of a tenant? Go to the studio instead.
  const membership = await db.member.findFirst({
    where: { userId: session.user.id },
    select: { organization: { select: { tenant: { select: { slug: true } } } } },
  });
  if (membership?.organization.tenant) {
    redirect(`/studio/${membership.organization.tenant.slug}`);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Teach on lms-web
      </h1>
      <p className="mt-2 text-muted-foreground">
        Set up your school. You get a branded storefront, course & project
        authoring, live cohorts, and payouts — without building any of it.
      </p>
      <div className="mt-8">
        <CreatorApplicationForm />
      </div>
    </div>
  );
}
