import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { createApp } from "../src/app";

let server: Server;
let base: string;
beforeAll(() => {
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

describe("request-body errors are client errors, not 500s", () => {
  it("malformed JSON -> 400", async () => {
    const res = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"email": broken' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Malformed JSON/);
  });

  it("oversized JSON -> 413", async () => {
    const body = JSON.stringify({ email: "a@b.co", password: "x".repeat(3_000_000) });
    const res = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    expect(res.status).toBe(413);
  });

  it("oversized form body -> 413", async () => {
    const res = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "x=" + "a".repeat(200_000) });
    expect(res.status).toBe(413);
  });
});
