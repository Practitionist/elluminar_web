"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { bulkEnrollSeats, upsertProgramCohort } from "@/actions/program";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CohortRow = {
  id: string;
  name: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number | null;
  enrolled: number;
};

export function ProgramCohortsPanel({
  tenantSlug,
  programId,
  cohorts,
  activatedSeats,
}: {
  tenantSlug: string;
  programId: string;
  cohorts: CohortRow[];
  activatedSeats: Array<{ id: string; label: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Cohorts</CardTitle>
        <CohortDialog tenantSlug={tenantSlug} programId={programId} />
      </CardHeader>
      <CardContent className="space-y-2">
        {cohorts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No cohorts yet — a cohort is a scheduled run of this program.
          </p>
        ) : (
          cohorts.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {c.enrolled}
                  {c.capacity ? `/${c.capacity}` : ""} enrolled
                  {c.startsAt
                    ? ` · ${new Date(c.startsAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}`
                    : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{c.status.toLowerCase()}</Badge>
                <EnrollSeatsDialog
                  tenantSlug={tenantSlug}
                  programCohortId={c.id}
                  seats={activatedSeats}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function CohortDialog({
  tenantSlug,
  programId,
}: {
  tenantSlug: string;
  programId: string;
}) {
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(upsertProgramCohort, {
    onSuccess: () => {
      toast.success("Cohort saved");
      setOpen(false);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            + Cohort
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New cohort</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            execute({
              tenantSlug,
              programId,
              name: String(form.get("name")),
              startsAt: form.get("startsAt") ? new Date(String(form.get("startsAt"))) : null,
              endsAt: form.get("endsAt") ? new Date(String(form.get("endsAt"))) : null,
              capacity: form.get("capacity") ? Number(form.get("capacity")) : null,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Fall 2026" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startsAt">Starts</Label>
              <Input id="startsAt" name="startsAt" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">Ends</Label>
              <Input id="endsAt" name="endsAt" type="date" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input id="capacity" name="capacity" type="number" min={1} />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Saving…" : "Save cohort"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EnrollSeatsDialog({
  tenantSlug,
  programCohortId,
  seats,
}: {
  tenantSlug: string;
  programCohortId: string;
  seats: Array<{ id: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const { execute, isPending } = useAction(bulkEnrollSeats, {
    onSuccess({ data }) {
      toast.success(`Enrolled ${data?.enrolled ?? 0} learners — courses & capstones fanned out.`);
      setOpen(false);
      setSelected([]);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" disabled={seats.length === 0}>
            Enroll seats
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll activated seats</DialogTitle>
        </DialogHeader>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
          {seats.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(s.id)}
                onCheckedChange={(checked) =>
                  setSelected((prev) =>
                    checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                  )
                }
              />
              {s.label}
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() =>
              setSelected(selected.length === seats.length ? [] : seats.map((s) => s.id))
            }
          >
            {selected.length === seats.length ? "Clear all" : "Select all"}
          </button>
          <Button
            disabled={selected.length === 0 || isPending}
            onClick={() => execute({ tenantSlug, programCohortId, seatIds: selected })}
          >
            {isPending ? "Enrolling…" : `Enroll ${selected.length}`}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Idempotent: re-enrolling the same learners never duplicates their
          courses or capstones.
        </p>
      </DialogContent>
    </Dialog>
  );
}
