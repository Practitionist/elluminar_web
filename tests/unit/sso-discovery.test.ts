import { afterEach, describe, expect, it, vi } from "vitest";

import { probeOidcDiscovery } from "@/lib/enterprise/sso";

/**
 * The discovery probe is what turns "this provider was registered but nobody
 * can sign in" into an inline form error. It runs before we persist anything,
 * so every failure mode here is one an org admin sees immediately instead of
 * discovering weeks later at an employee's first real sign-in.
 */

const VALID_DOC = {
  issuer: "https://acme.okta.com",
  authorization_endpoint: "https://acme.okta.com/oauth2/v1/authorize",
  token_endpoint: "https://acme.okta.com/oauth2/v1/token",
  jwks_uri: "https://acme.okta.com/oauth2/v1/keys",
};

function stubFetch(impl: (url: string) => Promise<Response> | Response) {
  vi.stubGlobal("fetch", vi.fn((input: string | URL) => impl(String(input))));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("probeOidcDiscovery", () => {
  it("accepts a well-formed discovery document", async () => {
    stubFetch(() => Response.json(VALID_DOC));
    const result = await probeOidcDiscovery("https://acme.okta.com");
    expect(result).toEqual({ ok: true, issuer: VALID_DOC.issuer });
  });

  it("requests the well-known path under the issuer", async () => {
    const seen: string[] = [];
    stubFetch((url) => {
      seen.push(url);
      return Response.json(VALID_DOC);
    });

    await probeOidcDiscovery("https://acme.okta.com");
    expect(seen[0]).toBe("https://acme.okta.com/.well-known/openid-configuration");
  });

  it("does not swallow a path segment on a trailing-slash issuer", async () => {
    // `new URL(path, base)` would drop "/oauth2" here; the probe builds the
    // string explicitly for exactly this reason.
    const seen: string[] = [];
    stubFetch((url) => {
      seen.push(url);
      return Response.json(VALID_DOC);
    });

    await probeOidcDiscovery("https://acme.okta.com/oauth2/default/");
    expect(seen[0]).toBe(
      "https://acme.okta.com/oauth2/default/.well-known/openid-configuration",
    );
  });

  it("refuses a non-HTTPS issuer", async () => {
    stubFetch(() => Response.json(VALID_DOC));
    const result = await probeOidcDiscovery("http://acme.okta.com");
    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.reason).toMatch(/HTTPS/i);
  });

  it("refuses an unparseable issuer without attempting a request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await probeOidcDiscovery("not a url at all");
    expect(result).toMatchObject({ ok: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports the status code when the issuer rejects the request", async () => {
    stubFetch(() => new Response("nope", { status: 404 }));
    const result = await probeOidcDiscovery("https://acme.okta.com");
    expect(result.ok === false && result.reason).toContain("404");
  });

  it("names the fields a partial document is missing", async () => {
    stubFetch(() =>
      Response.json({ issuer: "https://acme.okta.com", token_endpoint: "x" }),
    );
    const result = await probeOidcDiscovery("https://acme.okta.com");
    expect(result).toMatchObject({ ok: false });
    const reason = result.ok === false ? result.reason : "";
    expect(reason).toContain("authorization_endpoint");
    expect(reason).toContain("jwks_uri");
  });

  it("rejects a document whose endpoints are the wrong type", async () => {
    stubFetch(() => Response.json({ ...VALID_DOC, jwks_uri: 42 }));
    const result = await probeOidcDiscovery("https://acme.okta.com");
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a response that is not JSON at all", async () => {
    stubFetch(() => new Response("<html>login</html>", { status: 200 }));
    const result = await probeOidcDiscovery("https://acme.okta.com");
    expect(result).toMatchObject({ ok: false });
  });

  it("surfaces a network failure as an unreachable issuer", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")));
    const result = await probeOidcDiscovery("https://acme.okta.com");
    expect(result.ok === false && result.reason).toMatch(/could not reach/i);
  });

  it("gives up rather than hanging on a slow issuer", async () => {
    stubFetch(
      () =>
        new Promise<Response>((_resolve, reject) => {
          // Mirrors what AbortController produces on timeout.
          const err = new Error("aborted");
          err.name = "AbortError";
          setTimeout(() => reject(err), 5);
        }),
    );

    const result = await probeOidcDiscovery("https://acme.okta.com", {
      timeoutMs: 1,
    });
    expect(result.ok === false && result.reason).toMatch(/did not respond/i);
  });
});
