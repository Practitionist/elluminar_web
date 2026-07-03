"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient, useSession } from "@/lib/auth/client";

export default function AcceptInvitationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [loading, setLoading] = useState(false);

  async function onAccept() {
    setLoading(true);
    const { error } = await authClient.organization.acceptInvitation({
      invitationId: id,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Could not accept invitation");
      return;
    }
    toast.success("Welcome aboard!");
    router.push("/studio");
  }

  if (!isPending && !session) {
    router.push(`/sign-in?next=${encodeURIComponent(`/accept-invitation/${id}`)}`);
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join organization</CardTitle>
        <CardDescription>
          You&apos;ve been invited to collaborate. Accept to join the team.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-3">
        <Button onClick={onAccept} disabled={loading || isPending} className="flex-1">
          {loading ? "Joining…" : "Accept invitation"}
        </Button>
        <Button variant="outline" onClick={() => router.push("/")} className="flex-1">
          Decline
        </Button>
      </CardContent>
    </Card>
  );
}
