import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import Link from "next/link";

import { Pill, PrintButton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Certificate",
  robots: { index: false },
};

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const credential = await db.credential.findUnique({
    where: { verificationCode: decodeURIComponent(code).toUpperCase() },
    include: {
      user: { select: { name: true } },
      course: { include: { tenant: { select: { displayName: true } } } },
      projectInstance: {
        include: { project: { include: { tenant: { select: { displayName: true } } } } },
      },
      programEnrollment: {
        include: {
          programCohort: {
            include: {
              program: { include: { ownerTenant: { select: { displayName: true } } } },
            },
          },
        },
      },
    },
  });

  if (!credential || credential.revokedAt) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          Certificate unavailable
        </h1>
        <p className="mt-3 text-muted-foreground">
          {credential ? "This credential has been revoked." : "No credential matches that code."}
        </p>
      </div>
    );
  }

  const issuer =
    credential.course?.tenant.displayName ??
    credential.projectInstance?.project.tenant.displayName ??
    credential.programEnrollment?.programCohort.program.ownerTenant.displayName ??
    BRAND.name;
  const kindLabel =
    credential.kind === "PROJECT"
      ? "mentor-reviewed project"
      : credential.kind === "PROGRAM"
        ? "program"
        : "course";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button
          render={<Link href={`/verify/${credential.verificationCode}`} />}
          variant="ghost"
          className="rounded-full"
        >
          ← Back to verification
        </Button>
        <PrintButton />
      </div>

      {/* certificate */}
      <div className="relative overflow-hidden rounded-3xl border-4 border-primary/20 bg-card p-8 text-center shadow-xl shadow-foreground/5 sm:p-14 print:border-2 print:shadow-none">
        <div className="gradient-primary absolute inset-x-0 top-0 h-2" />
        <div className="flex items-center justify-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
            ✓
          </span>
          <span className="text-lg font-extrabold tracking-tight text-primary">
            {BRAND.name}
          </span>
        </div>

        <div className="mt-8 text-xs font-extrabold tracking-[0.2em] text-muted-foreground uppercase">
          Certificate of Achievement
        </div>
        <div className="mt-6 text-sm font-semibold text-muted-foreground">
          This certifies that
        </div>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-tight sm:text-5xl">
          {credential.user.name}
        </h1>
        <div className="mt-6 text-sm font-semibold text-muted-foreground">
          has successfully completed the {kindLabel}
        </div>
        <div className="mx-auto mt-2 max-w-xl font-display text-2xl font-medium text-primary">
          {credential.title}
        </div>

        {credential.grade ? (
          <div className="mt-5 flex justify-center">
            <Pill tone="distinction">★ {credential.grade}</Pill>
          </div>
        ) : null}

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-left sm:flex-row">
          <div className="text-xs font-semibold text-muted-foreground">
            <div className="font-extrabold text-foreground">Issued by {issuer}</div>
            <div>
              {credential.issuedAt.toLocaleDateString("en-IN", { dateStyle: "long" })}
            </div>
          </div>
          <div className="text-xs font-semibold text-muted-foreground sm:text-right">
            <div className="flex items-center gap-1 font-extrabold text-success-subtle-foreground">
              <BadgeCheck className="size-4" /> Verifiable credential
            </div>
            <div className="font-mono">
              {BRAND.name}/verify/{credential.verificationCode}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs font-semibold text-muted-foreground print:hidden">
        Anyone can confirm this certificate at{" "}
        <Link
          href={`/verify/${credential.verificationCode}`}
          className="text-primary hover:underline"
        >
          /verify/{credential.verificationCode}
        </Link>
      </p>
    </div>
  );
}
