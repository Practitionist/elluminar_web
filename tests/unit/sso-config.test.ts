import { describe, expect, it } from "vitest";

import { ssoConnectionUrls, ssoDomainRecordName } from "@/lib/enterprise/sso";
import { registerSsoProviderSchema } from "@/lib/validation/enterprise";

const PEM = [
  "-----BEGIN CERTIFICATE-----",
  "MIIDdzCCAl+gAwIBAgIEbGV0cw==",
  "-----END CERTIFICATE-----",
].join("\n");

const oidc = {
  tenantSlug: "acme-corp",
  providerId: "acme-okta",
  domain: "acme.com",
  protocol: "oidc" as const,
  issuer: "https://acme.okta.com",
  clientId: "client-id",
  clientSecret: "client-secret",
};

const saml = {
  tenantSlug: "acme-corp",
  providerId: "acme-shib",
  domain: "acme.edu",
  protocol: "saml" as const,
  issuer: "https://idp.acme.edu/shibboleth",
  entryPoint: "https://idp.acme.edu/idp/profile/SAML2/Redirect/SSO",
  cert: PEM,
};

describe("registerSsoProviderSchema", () => {
  it("accepts an OIDC provider", () => {
    expect(registerSsoProviderSchema.safeParse(oidc).success).toBe(true);
  });

  it("accepts a SAML provider", () => {
    expect(registerSsoProviderSchema.safeParse(saml).success).toBe(true);
  });

  it("requires a URL issuer for OIDC, since we probe its discovery document", () => {
    expect(
      registerSsoProviderSchema.safeParse({ ...oidc, issuer: "urn:acme:idp" }).success,
    ).toBe(false);
  });

  it("allows a URN issuer for SAML, where the issuer is an entity ID", () => {
    // Some university IdPs legitimately use a URN entity ID, and BetterAuth's
    // own register endpoint types issuer as a plain string.
    expect(
      registerSsoProviderSchema.safeParse({ ...saml, issuer: "urn:mace:acme.edu:idp" })
        .success,
    ).toBe(true);
  });

  it("rejects a certificate that isn't a PEM block", () => {
    const result = registerSsoProviderSchema.safeParse({
      ...saml,
      cert: "MIIDdzCCAl+gAwIBAgIEbGV0cw==",
    });
    expect(result.success).toBe(false);
  });

  it("rejects public email domains for both protocols", () => {
    // Otherwise anyone could claim gmail.com and auto-provision the world into
    // their organization.
    for (const input of [
      { ...oidc, domain: "gmail.com" },
      { ...saml, domain: "outlook.com" },
    ]) {
      const result = registerSsoProviderSchema.safeParse(input);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["domain"]);
    }
  });

  it("lowercases the domain so duplicate checks and IdP matching agree", () => {
    const result = registerSsoProviderSchema.parse({ ...oidc, domain: "ACME.com" });
    expect(result.domain).toBe("acme.com");
  });

  it("rejects a domain without a TLD", () => {
    expect(registerSsoProviderSchema.safeParse({ ...oidc, domain: "acme" }).success).toBe(
      false,
    );
  });

  it("does not accept OIDC credentials on a SAML registration", () => {
    const result = registerSsoProviderSchema.safeParse({
      ...saml,
      clientId: "leaked",
      clientSecret: "leaked",
    });
    // The union strips unknown keys rather than failing; what matters is that
    // they never reach the samlConfig we send to BetterAuth.
    expect(result.success).toBe(true);
    expect(result.data && "clientId" in result.data).toBe(false);
  });

  it("defaults SAML to signed assertions and SHA-256", () => {
    const parsed = registerSsoProviderSchema.parse(saml);
    expect(parsed).toMatchObject({
      protocol: "saml",
      wantAssertionsSigned: true,
      signatureAlgorithm: "sha256",
      digestAlgorithm: "sha256",
    });
  });

  it("offers no way to select SHA-1", () => {
    expect(
      registerSsoProviderSchema.safeParse({ ...saml, signatureAlgorithm: "sha1" }).success,
    ).toBe(false);
  });
});

describe("ssoConnectionUrls", () => {
  const urls = ssoConnectionUrls("acme-okta");

  it("points the ACS and metadata endpoints at BetterAuth's mounted routes", () => {
    expect(urls.acsUrl).toContain("/api/auth/sso/saml2/sp/acs/acme-okta");
    expect(urls.spMetadataUrl).toContain("/api/auth/sso/saml2/sp/metadata");
    expect(urls.spMetadataUrl).toContain("format=xml");
    expect(urls.sloUrl).toContain("/api/auth/sso/saml2/sp/slo/acme-okta");
    expect(urls.oidcRedirectUrl).toContain("/api/auth/sso/callback/acme-okta");
  });

  it("escapes a provider id so it cannot break out of the path", () => {
    const evil = ssoConnectionUrls("../../admin");
    expect(evil.acsUrl).not.toContain("../");
  });
});

describe("ssoDomainRecordName", () => {
  it("matches BetterAuth's default token prefix, with the RFC 8552 underscore", () => {
    expect(ssoDomainRecordName("acme-okta")).toBe("_better-auth-token-acme-okta");
  });
});
