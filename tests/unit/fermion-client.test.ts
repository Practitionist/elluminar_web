import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV = {
  FERMION_API_KEY: "test-key",
  DATABASE_URL: "postgresql://test",
  DIRECT_URL: "postgresql://test",
  BETTER_AUTH_SECRET: "x".repeat(32),
};

beforeEach(() => {
  vi.resetModules();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function loadClient() {
  return import("@/lib/fermion/client");
}

describe("fermionFetch", () => {
  it("wraps payloads in the batch envelope and unwraps ok outputs", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe("https://backend.codedamn.com/api/public/test");
      expect((init?.headers as Record<string, string>)["FERMION-API-KEY"]).toBe("test-key");
      expect(JSON.parse(String(init?.body))).toEqual({
        data: [{ data: { message: "ping" } }],
      });
      return new Response(
        JSON.stringify([{ output: { status: "ok", data: { message: "pong" } } }]),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fermionFetch } = await loadClient();
    const data = await fermionFetch<{ message: string }>("test", { message: "ping" });
    expect(data).toEqual({ message: "pong" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("surfaces Fermion-level errors with endpoint context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([{ output: { status: "error", errorMessage: "bad input" } }]),
            { status: 200 },
          ),
      ),
    );
    const { fermionFetch, FermionError } = await loadClient();
    await expect(fermionFetch("test", {})).rejects.toThrowError(FermionError);
    await expect(fermionFetch("test", {})).rejects.toThrow(/bad input/);
  });

  it("throws on HTTP-level failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const { fermionFetch } = await loadClient();
    await expect(fermionFetch("test", {})).rejects.toThrow(/HTTP 500/);
  });

  it("throws FermionNotConfiguredError without an API key", async () => {
    vi.stubEnv("FERMION_API_KEY", "");
    const { fermionFetch, FermionNotConfiguredError } = await loadClient();
    await expect(fermionFetch("test", {})).rejects.toThrowError(FermionNotConfiguredError);
  });
});
