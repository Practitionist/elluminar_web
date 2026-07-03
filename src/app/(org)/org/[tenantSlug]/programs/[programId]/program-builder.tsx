"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { addProgramItem, removeProgramItem, setUnlockRule } from "@/actions/program";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ItemRow = {
  id: string;
  itemType: string;
  title: string;
  required: boolean;
  unlockAfterItemId: string | null;
};

export function ProgramBuilder({
  tenantSlug,
  programId,
  items,
  courses,
  projects,
}: {
  tenantSlug: string;
  programId: string;
  items: ItemRow[];
  courses: Array<{ id: string; title: string }>;
  projects: Array<{ id: string; title: string }>;
}) {
  const [addType, setAddType] = useState<"COURSE" | "PROJECT">("COURSE");
  const [addId, setAddId] = useState("");
  const [addRequired, setAddRequired] = useState(true);

  const add = useAction(addProgramItem, {
    onSuccess: () => {
      toast.success("Item added");
      setAddId("");
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  const remove = useAction(removeProgramItem, {
    onSuccess: () => toast.success("Item removed"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  const unlock = useAction(setUnlockRule, {
    onSuccess: () => toast.success("Unlock rule saved"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  const titleById = new Map(items.map((i) => [i.id, i.title]));

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No items yet — add courses and a capstone project from the shared catalog.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground">{i + 1}.</span>
                <Badge variant="outline">{item.itemType.toLowerCase()}</Badge>
                <span className="truncate text-sm font-medium">{item.title}</span>
                {!item.required && <Badge variant="secondary">optional</Badge>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">unlocks after</span>
                <Select
                  value={item.unlockAfterItemId ?? "none"}
                  onValueChange={(v) =>
                    unlock.execute({
                      tenantSlug,
                      programId,
                      itemId: item.id,
                      unlockAfterItemId: v === "none" ? null : (v ?? null),
                    })
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— nothing (open)</SelectItem>
                    {items
                      .filter((other, oi) => other.id !== item.id && oi < i)
                      .map((other) => (
                        <SelectItem key={other.id} value={other.id}>
                          {titleById.get(other.id)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    if (window.confirm("Remove this item from the program?"))
                      remove.execute({ tenantSlug, programId, itemId: item.id });
                  }}
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed p-3">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={addType}
            onValueChange={(v) => {
              setAddType((v as never) ?? "COURSE");
              setAddId("");
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COURSE">Course</SelectItem>
              <SelectItem value="PROJECT">Project</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-64 flex-1 space-y-1">
          <Label className="text-xs">From the published catalog</Label>
          <Select value={addId} onValueChange={(v) => setAddId(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Pick an item" />
            </SelectTrigger>
            <SelectContent>
              {(addType === "COURSE" ? courses : projects).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Checkbox
            checked={addRequired}
            onCheckedChange={(c) => setAddRequired(Boolean(c))}
          />
          Required
        </label>
        <Button
          disabled={!addId || add.isPending}
          onClick={() =>
            add.execute({
              tenantSlug,
              programId,
              itemType: addType,
              courseId: addType === "COURSE" ? addId : undefined,
              projectId: addType === "PROJECT" ? addId : undefined,
              required: addRequired,
            })
          }
        >
          {add.isPending ? "Adding…" : "Add item"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Project items enroll learners without mentor-level selection; mentor
        matching for program capstones is coordinated with the platform team.
      </p>
    </div>
  );
}
