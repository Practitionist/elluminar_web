"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import {
  registerOrgSsoProvider,
  removeOrgSsoProvider,
} from "@/actions/org-sso";
import { FormAlert, SubmitButton, TextField } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { Field, FieldControl, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fieldErrors, formError } from "@/lib/safe-action";
import { slugify } from "@/lib/slug";
import type { SsoProtocol } from "@/lib/validation/enterprise";

import { SsoConnectionDetails } from "./sso-connection-details";

const PROTOCOLS: { value: SsoProtocol; label: string; hint: string }[] = [
  {
    value: "oidc",
    label: "OpenID Connect",
    hint: "Okta, Entra ID, Google Workspace, JumpCloud, Auth0",
  },
  {
    value: "saml",
    label: "SAML 2.0",
    hint: "Shibboleth, ADFS, and IdPs without an OIDC app",
  },
];

export function SsoProviderForm({ tenantSlug }: { tenantSlug: string }) {
  const [open, setOpen] = useState(false);
  const [protocol, setProtocol] = useState<SsoProtocol>("oidc");
  const [providerId, setProviderId] = useState("");
  const [issuedToken, setIssuedToken] = useState<{
    providerId: string;
    token: string | null;
  } | null>(null);

  const { execute, isPending, result, reset } = useAction(registerOrgSsoProvider, {
    onSuccess({ data }) {
      toast.success("Provider registered — verify your domain to switch it on.");
      setIssuedToken({
        providerId: data?.providerId ?? providerId,
        token: data?.domainVerificationToken ?? null,
      });
      setOpen(false);
    },
    onError: ({ error }) => {
      // Field-level problems are rendered inline; only surface the rest.
      if (!error.validationErrors) {
        toast.error(error.serverError ?? "Registration failed");
      }
    },
  });

  const errors = fieldErrors(result?.validationErrors);
  const topLevelError = formError(result?.validationErrors) ?? result?.serverError;

  if (issuedToken) {
    return (
      <SsoConnectionDetails
        tenantSlug={tenantSlug}
        providerId={issuedToken.providerId}
        initialToken={issuedToken.token}
        onDismiss={() => setIssuedToken(null)}
      />
    );
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        className="rounded-full"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        + Register an identity provider
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const id = slugify(String(form.get("providerId") ?? ""));
        setProviderId(id);

        const identity = {
          tenantSlug,
          providerId: id,
          domain: String(form.get("domain") ?? "").toLowerCase(),
          issuer: String(form.get("issuer") ?? ""),
        };

        execute(
          protocol === "oidc"
            ? {
                ...identity,
                protocol: "oidc",
                clientId: String(form.get("clientId") ?? ""),
                clientSecret: String(form.get("clientSecret") ?? ""),
              }
            : {
                ...identity,
                protocol: "saml",
                entryPoint: String(form.get("entryPoint") ?? ""),
                cert: String(form.get("cert") ?? ""),
                wantAssertionsSigned: true,
                authnRequestsSigned: false,
                signatureAlgorithm: "sha256",
                digestAlgorithm: "sha256",
                identifierFormat:
                  "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
              },
        );
      }}
      className="space-y-5 rounded-2xl border border-border p-5"
    >
      <fieldset className="space-y-2">
        <legend className="text-sm leading-none font-medium">Protocol</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROTOCOLS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setProtocol(p.value)}
              aria-pressed={protocol === p.value}
              className={
                protocol === p.value
                  ? "rounded-xl border-2 border-primary bg-primary-subtle p-3 text-left transition-colors"
                  : "rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/40"
              }
            >
              <span className="block text-sm font-semibold">{p.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {p.hint}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {topLevelError ? <FormAlert>{topLevelError}</FormAlert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="providerId"
          label="Provider id"
          error={errors.providerId}
          description="Appears in your IdP callback URLs. Lowercase, no spaces."
          inputProps={{ required: true, placeholder: "acme-okta" }}
        />
        <TextField
          name="domain"
          label="Email domain"
          error={errors.domain}
          description="Employees with this domain will be routed here."
          inputProps={{ required: true, placeholder: "acme.com" }}
        />
      </div>

      {protocol === "oidc" ? (
        <>
          <TextField
            name="issuer"
            label="Issuer URL"
            error={errors.issuer}
            description="We fetch /.well-known/openid-configuration from this URL before saving."
            inputProps={{
              type: "url",
              required: true,
              placeholder: "https://acme.okta.com",
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="clientId"
              label="Client ID"
              error={errors.clientId}
              inputProps={{ required: true, autoComplete: "off" }}
            />
            <TextField
              name="clientSecret"
              label="Client secret"
              error={errors.clientSecret}
              inputProps={{ type: "password", required: true, autoComplete: "off" }}
            />
          </div>
        </>
      ) : (
        <>
          <TextField
            name="issuer"
            label="IdP entity ID"
            error={errors.issuer}
            description="The IdP's issuer / entity ID, exactly as it appears in its metadata."
            inputProps={{
              required: true,
              placeholder: "http://www.okta.com/exk1a2b3c4",
            }}
          />
          <TextField
            name="entryPoint"
            label="IdP SSO URL"
            error={errors.entryPoint}
            description="Where we send the authentication request (HTTP-Redirect binding)."
            inputProps={{
              type: "url",
              required: true,
              placeholder: "https://acme.okta.com/app/.../sso/saml",
            }}
          />
          <Field name="cert" error={errors.cert}>
            <FieldLabel>IdP signing certificate</FieldLabel>
            <FieldControl>
              <Textarea
                rows={6}
                required
                className="font-mono text-xs"
                placeholder={"-----BEGIN CERTIFICATE-----\nMIID…\n-----END CERTIFICATE-----"}
              />
            </FieldControl>
            <FieldDescription>
              Paste the full PEM block. We verify every assertion against it, and
              reject SHA-1 signatures.
            </FieldDescription>
          </Field>
        </>
      )}

      <div className="flex gap-2">
        <SubmitButton pending={isPending} pendingLabel="Registering…" className="w-auto px-6">
          Register provider
        </SubmitButton>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="rounded-full"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Registering does not switch SSO on. The provider stays inert until you
        prove you own <Label className="inline font-mono">{"{domain}"}</Label> with
        a DNS record — we show you the exact record next.
      </p>
    </form>
  );
}

export function SsoRemoveButton({
  tenantSlug,
  providerId,
}: {
  tenantSlug: string;
  providerId: string;
}) {
  const { execute, isPending } = useAction(removeOrgSsoProvider, {
    onSuccess: () => toast.success("Provider removed"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="rounded-full"
      disabled={isPending}
      aria-label="Remove SSO provider"
      onClick={() => {
        if (
          window.confirm(
            "Remove this SSO provider? Members can still sign in with email.",
          )
        )
          execute({ tenantSlug, providerId });
      }}
    >
      ✕
    </Button>
  );
}
