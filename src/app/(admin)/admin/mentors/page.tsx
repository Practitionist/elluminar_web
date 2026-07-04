import { Pill } from "@/components/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { tiptapToPlainText } from "@/lib/richtext";

import { MentorVetButtons } from "./mentor-vet-buttons";

export const metadata = { title: "Mentor vetting" };

export default async function AdminMentorsPage() {
  const applicants = await db.mentorProfile.findMany({
    where: { status: { in: ["APPLIED", "IN_REVIEW"] } },
    orderBy: { appliedAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        Mentor vetting
      </h1>
      {applicants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending applications.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                  Applicant
                </TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                  Headline
                </TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                  Expertise
                </TableHead>
                <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">
                  Decision
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applicants.map((m) => (
                <TableRow key={m.id} className="border-t border-border">
                  <TableCell>
                    <div className="font-medium">{m.user.name}</div>
                    <div className="text-xs text-muted-foreground">{m.user.email}</div>
                  </TableCell>
                  <TableCell className="max-w-sm">
                    <div className="text-sm">{m.headline}</div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {tiptapToPlainText(m.bio)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-[200px] flex-wrap gap-1">
                      {m.expertiseTags.slice(0, 5).map((t) => (
                        <Pill key={t} tone="neutral">
                          {t}
                        </Pill>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <MentorVetButtons mentorProfileId={m.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
