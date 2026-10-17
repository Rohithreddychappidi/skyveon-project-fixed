import { beforeEach, describe, expect, it, vi } from "vitest";

// Fresh module per test so the in-memory token / in-flight refresh reset.
async function loadApi() {
  vi.resetModules();
  return import("@/lib/api");
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("token refresh", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("shares one refresh between concurrent callers", async () => {
    const api = await loadApi();
    const fetchMock = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return json(200, { accessToken: "new-token" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.all([api.refreshAccessToken(), api.refreshAccessToken(), api.refreshAccessToken()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r?.accessToken === "new-token")).toBe(true);
  });

  it("parallel requests that all hit an expired token trigger a single refresh and don't log out", async () => {
    const api = await loadApi();
    api.setAccessToken("expired");
    const onUnauthorized = vi.fn();
    api.setUnauthorizedHandler(onUnauthorized);

    let refreshCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/auth/refresh")) {
          refreshCalls++;
          await new Promise((r) => setTimeout(r, 20));
          // A second rotation with the same cookie would fail server-side.
          return refreshCalls === 1 ? json(200, { accessToken: "fresh" }) : json(401, { error: "revoked" });
        }
        const auth = new Headers(init?.headers).get("Authorization");
        return auth === "Bearer fresh" ? json(200, { ok: true }) : json(401, { error: "expired" });
      })
    );

    const results = await Promise.all([api.api.get("/api/a"), api.api.get("/api/b"), api.api.get("/api/c")]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("builds absolute file URLs from the relative path the API returns", async () => {
    const api = await loadApi();
    expect(api.apiUrl("/api/files/x/stream?token=t")).toBe(`${api.API_BASE_URL}/api/files/x/stream?token=t`);
  });
});
