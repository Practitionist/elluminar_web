import { AlertTriangle, MailWarning } from "lucide-react";
import Link from "next/link";

import { AuthHeader, FormAlert } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { parseOrgRoles } from "@/lib/auth/roles";
import { db } from "@/lib/db";

import { InvitationActions } from "./invitation-actions";

export const metadata = { title: "Join organization" };

const ROLE_COPY: Record<string, string> = {
  owner: "Owner — full control, including billing and payouts",
  admin: "Admin — manage content, people and commerce",
  instructor: "Instructor — author courses and review learner work",
  member: "Member — access the organization's courses and programs",
};

/**
 * Server component. The client version rendered a generic "You've been invited
 * to collaborate" with no idea which organization, called `router.push` during
 * render to bounce signed-out users, and its Decline button merely navigated
 * home — leaving the invitation pending forever.
 */
export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, invitation] = await Promise.all([
    getSession(),
    db.invitation.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        inviter: { select: { name: true } },
        organization: {
          select: {
            name: true,
            tenant: { select: { slug: true, type: true } },
          },
        },
      },
    }),
  ]);

  if (!invitation) return <InvitationProblem title="This invitation doesn't exist" />;

  if (invitation.status === "accepted") {
    return (
      <InvitationProblem
        title="Already accepted"
        description={`You're already a member of ${invitation.organization.name}.`}
        action={{ href: "/learn", label: "Go to your dashboard" }}
      />
    );
  }

  if (invitation.status !== "pending") {
    return (
      <InvitationProblem
        title="This invitation was withdrawn"
        description="Ask whoever invited you to send a new one."
      />
    );
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <InvitationProblem
        title="This invitation has expired"
        description={`Invitations last 72 hours. Ask ${invitation.inviter.name} to send a fresh one.`}
      />
    );
  }

  const role = parseOrgRoles(invitation.role)[0] ?? "member";
  const tenant = invitation.organization.tenant;
  // Enterprise and university invitees belong in the org portal; only creator
  // teams land in the studio. The old page pushed everyone to /studio.
  const destination =
    tenant && tenant.type !== "CREATOR" ? `/org/${tenant.slug}` : "/studio";

  const summary = (
    <dl className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Organization</dt>
        <dd className="text-right font-semibold">{invitation.organization.name}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Invited by</dt>
        <dd className="text-right font-medium">{invitation.inviter.name}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Your role</dt>
        <dd className="text-right font-medium capitalize">{role}</dd>
      </div>
      <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        {ROLE_COPY[role] ?? ROLE_COPY.member}
      </p>
    </dl>
  );

  if (!session) {
    const next = `/accept-invitation/${id}`;
    return (
      <div className="space-y-6">
        <AuthHeader
          title={`Join ${invitation.organization.name}`}
          description={`${invitation.inviter.name} invited you to collaborate.`}
        />
        {summary}
        <div className="flex flex-col gap-2">
          <Button
            render={
              <Link
                href={`/sign-in?next=${encodeURIComponent(next)}`}
              />
            }
            size="lg"
            className="w-full rounded-full"
          >
            Sign in to accept
          </Button>
          <Button
            render={
              <Link
                href={`/sign-up?email=${encodeURIComponent(invitation.email)}`}
              />
            }
            variant="outline"
            size="lg"
            className="w-full rounded-full"
          >
            Create an account
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          This invitation was sent to{" "}
          <span className="font-medium text-foreground">{invitation.email}</span>.
        </p>
      </div>
    );
  }

  // BetterAuth enforces this server-side too; checking here turns an opaque API
  // rejection into an explanation of what to do about it.
  const emailMatches =
    session.user.email.toLowerCase() === invitation.email.toLowerCase();

  if (!emailMatches) {
    return (
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-full bg-distinction-subtle">
          <MailWarning className="size-6 text-distinction-subtle-foreground" />
        </div>
        <AuthHeader
          title="This invitation is for a different account"
          description={
            <>
              It was sent to{" "}
              <span className="font-medium text-foreground">{invitation.email}</span>
              , but you&apos;re signed in as{" "}
              <span className="font-medium text-foreground">{session.user.email}</span>.
            </>
          }
        />
        <FormAlert tone="info">
          Sign out and sign back in with the invited address, or ask{" "}
          {invitation.inviter.name} to re-send it to this one.
        </FormAlert>
        <Button
          render={<Link href="/learn" />}
          variant="outline"
          size="lg"
          className="w-full rounded-full"
        >
          Back to your dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader
        title={`Join ${invitation.organization.name}`}
        description={`${invitation.inviter.name} invited you to collaborate.`}
      />
      {summary}
      <InvitationActions
        invitationId={id}
        destination={destination}
        organizationName={invitation.organization.name}
      />
    </div>
  );
}

function InvitationProblem({
  title,
  description,
  action = { href: "/", label: "Back to home" },
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="space-y-6">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive-subtle">
        <AlertTriangle className="size-6 text-destructive-subtle-foreground" />
      </div>
      <AuthHeader title={title} description={description} />
      <Button
        render={<Link href={action.href} />}
        variant="outline"
        size="lg"
        className="w-full rounded-full"
      >
        {action.label}
      </Button>
    </div>
  );
}
