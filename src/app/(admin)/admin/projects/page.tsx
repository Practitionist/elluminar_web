import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";

import { AssignMentorDialog } from "./assign-mentor-dialog";

export const metadata = { title: "Project matching" };

export default async function AdminProjectsPage() {
  const [pending, mentors] = await Promise.all([
    db.projectInstance.findMany({
      where: { status: "PENDING_KICKOFF" },
      orderBy: { createdAt: "asc" },
      include: {
        project: { select: { title: true, tier: true, techStack: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    db.mentorProfile.findMany({
      where: { status: "ACTIVE" },
      include: {
        user: { select: { name: true } },
        assignments: { where: { unassignedAt: null }, select: { id: true } },
      },
      orderBy: { level: "desc" },
    }),
  ]);

  const mentorOptions = mentors.map((m) => ({
    id: m.id,
    label: `${m.user.name} · ${m.level.toLowerCase()} · ${m.assignments.length}/${m.maxActiveInstances} active · ${m.expertiseTags.slice(0, 3).join(", ")}`,
    atCapacity: m.assignments.length >= m.maxActiveInstances,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mentor matching</h1>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">No instances waiting for a mentor.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Learner</TableHead>
              <TableHead>Requested level</TableHead>
              <TableHead>Waiting since</TableHead>
              <TableHead className="text-right">Assign</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((pi) => (
              <TableRow key={pi.id}>
                <TableCell>
                  <div className="font-medium">{pi.project.title}</div>
                  <div className="flex gap-1">
                    <Badge>{pi.project.tier.toLowerCase()}</Badge>
                    {pi.project.techStack.slice(0, 3).map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div>{pi.user.name}</div>
                  <div className="text-xs text-muted-foreground">{pi.user.email}</div>
                </TableCell>
                <TableCell>
                  {pi.requestedMentorLevel ? (
                    <Badge variant="secondary">{pi.requestedMentorLevel.toLowerCase()}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {pi.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </TableCell>
                <TableCell className="text-right">
                  <AssignMentorDialog projectInstanceId={pi.id} mentors={mentorOptions} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
