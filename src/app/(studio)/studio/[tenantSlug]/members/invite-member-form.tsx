"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth/client";

export function InviteMemberForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [role, setRole] = useState("instructor");
  const [pending, setPending] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setPending(true);
        const { error } = await authClient.organization.inviteMember({
          organizationId,
          email: String(form.get("email")),
          role: role as never,
        });
        setPending(false);
        if (error) {
          toast.error(error.message ?? "Invite failed");
          return;
        }
        toast.success("Invitation sent");
        router.refresh();
      }}
      className="flex gap-2"
    >
      <Input name="email" type="email" placeholder="colleague@school.dev" required className="flex-1" />
      <Select value={role} onValueChange={(v) => setRole(v ?? "instructor")}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="instructor">Instructor</SelectItem>
          <SelectItem value="member">Member</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" disabled={pending} className="rounded-full">
        {pending ? "Sending…" : "Invite"}
      </Button>
    </form>
  );
}
