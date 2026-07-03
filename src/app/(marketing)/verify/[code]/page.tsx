import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Credential verification",
  robots: { index: false },
};

export default async function VerifyCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const credential = await db.credential.findUnique({
    where: { verificationCode: decodeURIComponent(code).toUpperCase() },
    include: {
      user: { select: { name: true } },
      course: { include: { tenant: { select: { displayName: true, slug: true } } } },
      projectInstance: {
        include: {
          project: { include: { tenant: { select: { displayName: true, slug: true } } } },
        },
      },
      programEnrollment: {
        include: {
          programCohort: {
            include: {
              program: {
                include: { ownerTenant: { select: { displayName: true, slug: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!credential) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="mt-2 text-muted-foreground">
          No credential matches that code. Check for typos — codes look like
          XXXX-XXXX-XXXX.
        </p>
        <Button render={<Link href="/verify" />} variant="outline" className="mt-6">
          Try another code
        </Button>
      </div>
    );
  }

  const revoked = Boolean(credential.revokedAt);
  const coBrandPartner = (credential.metadata as { coBrandPartner?: string } | null)
    ?.coBrandPartner;
  const issuer =
    credential.course?.tenant.displayName ??
    credential.projectInstance?.project.tenant.displayName ??
    credential.programEnrollment?.programCohort.program.ownerTenant.displayName ??
    "lms-web";
  const issuerLine = coBrandPartner ? `${issuer} × ${coBrandPartner}` : issuer;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Card className={revoked ? "border-destructive" : "border-green-600/40"}>
        <CardContent className="space-y-6 py-10 text-center">
          {revoked ? (
            <Badge variant="destructive" className="mx-auto">
              REVOKED{credential.revokeReason ? ` — ${credential.revokeReason}` : ""}
            </Badge>
          ) : (
            <Badge className="mx-auto bg-green-600 hover:bg-green-600">✓ Verified authentic</Badge>
          )}
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              {credential.kind === "PROJECT"
                ? "Mentor-Verified Project"
                : credential.kind === "PROGRAM"
                  ? "Program Certificate"
                  : "Certificate of Completion"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{credential.title}</h1>
          </div>
          <div className="space-y-1">
            <p className="text-lg">
              Awarded to <span className="font-semibold">{credential.user.name}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Issued by {issuerLine} ·{" "}
              {credential.issuedAt.toLocaleDateString("en-IN", { dateStyle: "long" })}
              {credential.grade ? ` · Grade: ${credential.grade}` : ""}
            </p>
            {credential.kind === "PROJECT" && (
              <p className="text-xs text-muted-foreground">
                This work was reviewed against a rubric by a vetted mentor
                {(credential.metadata as { defenseRequired?: boolean } | null)?.defenseRequired
                  ? " and defended live"
                  : ""}
                .
              </p>
            )}
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            {credential.verificationCode}
          </p>
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Verified against the lms-web credential registry in real time.
      </p>
    </div>
  );
}
