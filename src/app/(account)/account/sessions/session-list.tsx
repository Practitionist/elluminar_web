"use client";

import { formatDistanceToNow } from "date-fns";
import { Monitor } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { recordSecurityEvent } from "@/actions/account";
import { AccountSection } from "@/components/account/section";
import { FormAlert } from "@/components/auth";
import { Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export type SessionRow = {
  token: string;
  device: string;
  ipAddress: string | null;
  /** ISO strings — Dates don't survive the RSC boundary as Dates in props. */
  lastActive: string;
  signedInAt: string;
  isCurrent: boolean;
};

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const audit = useAction(recordSecurityEvent);

  const others = sessions.filter((s) => !s.isCurrent);

  async function revokeOne(token: string) {
    setError(undefined);
    setBusy(token);
    const { error: revokeError } = await authClient.revokeSession({ token });
    setBusy(null);

    if (revokeError) {
      setError(revokeError.message ?? "Could not revoke that session.");
      return;
    }
    toast.success("Signed out on that device.");
    router.refresh();
  }

  async function revokeOthers() {
    setError(undefined);
    setBusy("others");
    const { error: revokeError } = await authClient.revokeOtherSessions();
    setBusy(null);

    if (revokeError) {
      setError(revokeError.message ?? "Could not sign out the other devices.");
      return;
    }
    audit.execute({ event: "sessions.revoked_others" });
    toast.success("Signed out everywhere else.");
    router.refresh();
  }

  return (
    <AccountSection
      title="Active sessions"
      description="A session ends when it's revoked or expires. Signing out of a device here takes effect immediately."
      footer={
        others.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={busy !== null}
            onClick={revokeOthers}
          >
            {busy === "others"
              ? "Signing out…"
              : `Sign out ${others.length} other ${others.length === 1 ? "device" : "devices"}`}
          </Button>
        ) : (
          "This is your only active session."
        )
      }
    >
      <div className="space-y-3">
        {error ? <FormAlert>{error}</FormAlert> : null}

        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.token}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Monitor className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{s.device}</span>
                    {s.isCurrent ? <Pill tone="success">this device</Pill> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {s.ipAddress ? `${s.ipAddress} · ` : ""}
                    active{" "}
                    {formatDistanceToNow(new Date(s.lastActive), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {s.isCurrent ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  disabled={busy !== null}
                  onClick={() => revokeOne(s.token)}
                >
                  {busy === s.token ? "Revoking…" : "Sign out"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </AccountSection>
  );
}
