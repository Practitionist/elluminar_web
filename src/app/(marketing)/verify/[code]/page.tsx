import type { Metadata } from "next";
import { ShieldCheck, ShieldX } from "lucide-react";
import Link from "next/link";

import { Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { coBrandPartnerFrom, issuerLine } from "@/lib/credentials/issuer-line";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Credential verification",
  robots: { index: false },
};

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "•"
  );
}

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
          projectReviews: {
            where: { kind: "MENTOR_FINAL" },
            orderBy: { completedAt: "desc" },
            take: 1,
            include: {
              rubricScores: {
                include: { rubricCriterion: { select: { name: true } } },
              },
            },
          },
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
        <h1 className="font-display text-3xl font-medium tracking-tight">
          Not found
        </h1>
        <p className="mt-3 text-muted-foreground">
          No credential matches that code. Check for typos — codes look like
          XXXX-XXXX-XXXX.
        </p>
        <Button
          render={<Link href="/verify" />}
          variant="outline"
          className="mt-6 rounded-full"
        >
          Try another code
        </Button>
      </div>
    );
  }

  const revoked = Boolean(credential.revokedAt);
  const coBrandPartner = coBrandPartnerFrom(credential.metadata);
  const issuer =
    credential.course?.tenant.displayName ??
    credential.projectInstance?.project.tenant.displayName ??
    credential.programEnrollment?.programCohort.program.ownerTenant.displayName ??
    BRAND.name;
  const issuerText = issuerLine(issuer, coBrandPartner);

  const kindLabel =
    credential.kind === "PROJECT"
      ? "Verified project credential"
      : credential.kind === "PROGRAM"
        ? "Program certificate"
        : "Certificate of completion";

  const finalReview = credential.projectInstance?.projectReviews[0];
  const rubric = finalReview?.rubricScores ?? [];
  const reviewer = finalReview?.reviewerId
    ? await db.user.findUnique({
        where: { id: finalReview.reviewerId },
        select: { name: true },
      })
    : null;
  const issuedLong = credential.issuedAt.toLocaleDateString("en-IN", {
    dateStyle: "long",
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Verdict banner */}
      {revoked ? (
        <div className="flex items-center gap-4 rounded-2xl border border-destructive/20 bg-destructive-subtle px-5 py-4 sm:px-6">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
            <ShieldX className="size-6" />
          </span>
          <div className="flex-1">
            <div className="text-lg font-extrabold text-destructive-subtle-foreground">
              Credential revoked
              {credential.revokedAt
                ? ` — ${credential.revokedAt.toLocaleDateString("en-IN", { dateStyle: "long" })}`
                : ""}
            </div>
            <div className="text-xs font-semibold text-destructive-subtle-foreground/80">
              {credential.revokeReason
                ? `Reason: ${credential.revokeReason}. `
                : ""}
              Revocations are permanent and public.
            </div>
          </div>
          <span className="hidden rounded-lg border border-destructive/20 bg-card px-3 py-1.5 font-mono text-sm font-semibold text-destructive-subtle-foreground sm:inline">
            {credential.verificationCode}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border border-success/20 bg-success-subtle px-5 py-4 sm:px-6">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
            <ShieldCheck className="size-6" />
          </span>
          <div className="flex-1">
            <div className="text-lg font-extrabold text-success-subtle-foreground">
              Valid credential
            </div>
            <div className="text-xs font-semibold text-success-subtle-foreground/80">
              Issued {issuedLong} · never revoked · checked against the registry
              in real time
            </div>
          </div>
          <span className="hidden rounded-lg border border-success/20 bg-card px-3 py-1.5 font-mono text-sm font-semibold text-success-subtle-foreground sm:inline">
            {credential.verificationCode}
          </span>
        </div>
      )}

      {/* Credential card */}
      <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">
          {kindLabel}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-lg font-extrabold text-primary-subtle-foreground">
            {initialsOf(credential.user.name ?? "•")}
          </span>
          <div>
            <div className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
              {credential.user.name}
            </div>
            <div className="text-sm font-semibold text-muted-foreground">
              {credential.title}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {credential.grade ? (
            <Pill tone="distinction">★ {credential.grade}</Pill>
          ) : null}
          {finalReview?.overallScore != null ? (
            <Pill tone="success">{finalReview.overallScore.toFixed(1)} / 10</Pill>
          ) : null}
          <Pill tone="neutral">Issued by {issuerText}</Pill>
          <Pill tone="neutral">{issuedLong}</Pill>
        </div>

        {/* Rubric — the auditable part */}
        {rubric.length > 0 ? (
          <div className="mt-7 border-t border-border pt-6">
            <div className="mb-4 text-sm font-extrabold">
              Reviewed across {rubric.length}{" "}
              {rubric.length === 1 ? "criterion" : "criteria"}
            </div>
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {rubric.map((rs) => {
                const pct = Math.round((rs.score / (rs.maxScore || 10)) * 100);
                return (
                  <div
                    key={rs.rubricCriterionId}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm font-bold text-muted-foreground"
                  >
                    <span className="w-28 truncate">
                      {rs.rubricCriterion.name}
                    </span>
                    <span className="h-2 rounded-full bg-muted">
                      <span
                        className="block h-2 rounded-full bg-success"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="w-10 text-right font-extrabold text-foreground">
                      {rs.score.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : credential.kind === "PROJECT" ? (
          <p className="mt-6 border-t border-border pt-6 text-sm text-muted-foreground">
            Reviewed against a rubric by a vetted mentor
            {(credential.metadata as { defenseRequired?: boolean } | null)
              ?.defenseRequired
              ? " and defended live"
              : ""}
            .
          </p>
        ) : null}

        {/* Reviewer */}
        {reviewer?.name ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3">
            <span className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">
              Reviewed &amp; signed by
            </span>
            <span className="text-sm font-extrabold text-foreground">
              {reviewer.name}
            </span>
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">
        This page is the source of truth — no account needed. Verified against
        the {BRAND.name} credential registry in real time.
      </p>
    </div>
  );
}
