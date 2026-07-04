import Link from "next/link";

import { Pill, type PillTone } from "@/components/shared";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata = { title: "My programs" };

const PROGRAM_STATUS_TONE: Record<string, PillTone> = {
  ENROLLED: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  DROPPED: "destructive",
};

export default async function MyProgramsPage() {
  const session = await requireUser("/learn/programs");

  const enrollments = await db.programEnrollment.findMany({
    where: { userId: session.user.id },
    orderBy: { enrolledAt: "desc" },
    include: {
      programCohort: {
        include: {
          program: {
            include: {
              ownerTenant: { select: { displayName: true } },
              items: { select: { required: true } },
            },
          },
        },
      },
      credentials: { select: { verificationCode: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        My programs
      </h1>
      {enrollments.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          No programs yet — programs are assigned by your company or university once
          you&apos;re rostered.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {enrollments.map((pe) => (
            <Link
              key={pe.id}
              href={`/learn/programs/${pe.id}`}
              className="rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <Pill tone={PROGRAM_STATUS_TONE[pe.status] ?? "neutral"}>
                  {pe.status.toLowerCase().replace("_", " ")}
                </Pill>
                {pe.credentials[0] && <Pill tone="distinction">certified 🎓</Pill>}
              </div>
              <div className="mt-2 line-clamp-2 text-base font-extrabold">
                {pe.programCohort.program.title}
              </div>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {pe.programCohort.program.ownerTenant.displayName} ·{" "}
                {pe.programCohort.name} · {pe.programCohort.program.items.length} items
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
