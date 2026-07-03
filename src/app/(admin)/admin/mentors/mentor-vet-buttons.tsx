"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { vetMentor } from "@/actions/mentor";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MentorVetButtons({ mentorProfileId }: { mentorProfileId: string }) {
  const [level, setLevel] = useState<"ASSOCIATE" | "SENIOR" | "PRINCIPAL">("ASSOCIATE");
  const { execute, isPending } = useAction(vetMentor, {
    onSuccess: () => toast.success("Decision recorded"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <div className="flex items-center justify-end gap-2">
      <Select value={level} onValueChange={(v) => setLevel((v as never) ?? "ASSOCIATE")}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ASSOCIATE">Associate</SelectItem>
          <SelectItem value="SENIOR">Senior</SelectItem>
          <SelectItem value="PRINCIPAL">Principal</SelectItem>
        </SelectContent>
      </Select>
      <Button
        size="sm"
        disabled={isPending}
        onClick={() => execute({ mentorProfileId, decision: "ACTIVE", level })}
      >
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => execute({ mentorProfileId, decision: "SUSPENDED" })}
      >
        Reject
      </Button>
    </div>
  );
}
