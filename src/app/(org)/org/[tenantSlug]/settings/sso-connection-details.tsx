"use client";

import { Check, Copy } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import {
  requestSsoDomainVerification,
  verifySsoDomain,
} from "@/actions/org-sso";
import { FormAlert, SubmitButton } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { ssoConnectionUrls, ssoDomainRecordName } from "@/lib/enterprise/sso";

/**
 * A one-line copyable value. Enterprise IdP setup is a transcription exercise —
 * an ACS URL retyped by hand is the single most common cause of a SAML
 * integration failing on first contact, so nothing here is meant to be typed.
 */
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs break-all">
          {value}
        </code>
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0 rounded-md"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              // Clipboard is blocked in some embedded browsers; the value is
              // selectable on screen, so this is a degraded path, not an error.
              toast.error("Copy blocked — select the value manually.");
            }
          }}
        >
          {copied ? (
            <Check className="size-3.5 text-success" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function SsoConnectionDetails({
  tenantSlug,
  providerId,
  domain,
  protocol,
  domainVerified = false,
  initialToken = null,
  onDismiss,
}: {
  tenantSlug: string;
  providerId: string;
  domain?: string;
  protocol?: "oidc" | "saml";
  domainVerified?: boolean;
  initialToken?: string | null;
  onDismiss?: () => void;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const urls = ssoConnectionUrls(providerId);

  const request = useAction(requestSsoDomainVerification, {
    onSuccess({ data }) {
      setToken(data?.domainVerificationToken ?? null);
      toast.success("New verification token issued.");
    },
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Could not issue a token"),
  });

  const verify = useAction(verifySsoDomain, {
    onSuccess: () => toast.success("Domain verified — SSO is now live."),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Verification failed"),
  });

  const showSaml = protocol !== "oidc";
  const showOidc = protocol !== "saml";

  return (
    <div className="space-y-6 rounded-2xl border border-border p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-medium tracking-tight">
            Connection details
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste these into your identity provider. Nothing here is secret.
          </p>
        </div>
        {onDismiss ? (
          <Button variant="ghost" size="sm" className="rounded-full" onClick={onDismiss}>
            Done
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        {showSaml ? (
          <>
            <CopyRow label="ACS / Reply URL" value={urls.acsUrl} />
            <CopyRow label="SP Entity ID / Audience" value={urls.spEntityId} />
            <CopyRow label="SP metadata (XML)" value={urls.spMetadataUrl} />
            <CopyRow label="Single Logout URL" value={urls.sloUrl} />
          </>
        ) : null}
        {showOidc ? (
          <CopyRow label="OIDC redirect URI" value={urls.oidcRedirectUrl} />
        ) : null}
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
        <div>
          <h4 className="text-sm font-semibold">Domain verification</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Sign-ins are refused until we can confirm you control{" "}
            <span className="font-mono">{domain ?? "this domain"}</span>. Publish
            this TXT record, then check it below.
          </p>
        </div>

        {domainVerified ? (
          <FormAlert tone="success" title="Verified">
            SSO is live for this domain. To re-run the DNS check, a platform
            admin must first revoke verification.
          </FormAlert>
        ) : (
          <>
            <CopyRow
              label="Record name"
              value={`${ssoDomainRecordName(providerId)}${domain ? `.${domain}` : ""}`}
            />
            {token ? (
              <CopyRow label="Record value" value={token} />
            ) : (
              <FormAlert tone="info">
                The token is shown once at registration. Issue a new one if you
                no longer have it — any previously published record stops working.
              </FormAlert>
            )}

            <div className="flex flex-wrap gap-2">
              <SubmitButton
                pending={verify.isPending}
                pendingLabel="Checking DNS…"
                className="w-auto px-6"
                onClick={() => verify.execute({ tenantSlug, providerId })}
                type="button"
              >
                I&apos;ve published the record
              </SubmitButton>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="rounded-full"
                disabled={request.isPending}
                onClick={() => request.execute({ tenantSlug, providerId })}
              >
                {request.isPending ? "Issuing…" : "Issue a new token"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              DNS changes usually appear within minutes but can take up to an hour.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
