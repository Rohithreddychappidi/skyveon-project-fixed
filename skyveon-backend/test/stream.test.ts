import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "net";
import type { Server } from "http";

// In-memory stand-in for the handful of Prisma calls the files routes make.
const db = vi.hoisted(() => ({
  lessons: [] as Record<string, unknown>[],
  users: [] as Record<string, unknown>[],
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    lesson: {
      findFirst: async ({ where }: { where: { id: string } }) => db.lessons.find((l) => l.id === where.id) ?? null,
      findMany: async () => db.lessons,
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => db.users.find((u) => u.id === where.id) ?? null,
    },
    module: { findMany: async () => [] },
    lessonSubmission: { findMany: async () => [] },
    assignment: { findFirst: async () => ({ id: "assignment" }) },
    activityLog: { create: async () => ({}) },
  },
}));

import { createApp } from "../src/app";
import { getStorage } from "../src/lib/storage";
import { signAccessToken } from "../src/lib/jwt";

const VIDEO = Buffer.from(Array.from({ length: 10_000 }, (_, i) => i % 256));
let server: Server;
let base: string;

beforeAll(async () => {
  await getStorage().save("2026/10/test-video.mp4", VIDEO);
  db.users.push({ id: "emp1", role: "EMPLOYEE", status: "ACTIVE", isDeleted: false, name: "E", email: "e@x.com", departmentId: null, adminPermissions: [] });
  db.lessons.push({
    id: "vid1", courseId: "c1", moduleId: null, order: 0, type: "VIDEO", title: "Video",
    fileKey: "2026/10/test-video.mp4", fileName: "v.mp4", fileMime: "video/mp4",
    convertedKey: null, conversionStatus: "NOT_REQUIRED", durationSeconds: 600, isDeleted: false,
  });
  db.lessons.push({
    id: "ppt1", courseId: "c1", moduleId: null, order: 1, type: "PPT", title: "Deck",
    fileKey: "2026/10/deck.pptx", fileName: "deck.pptx", fileMime: "application/vnd.ms-powerpoint",
    convertedKey: null, conversionStatus: "PENDING", durationSeconds: null, isDeleted: false,
  });
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => server.close());

const auth = () => ({ Authorization: `Bearer ${signAccessToken({ sub: "emp1", role: "EMPLOYEE", email: "e@x.com" })}` });

describe("lesson file links and streaming", () => {
  it("returns a relative path (no http:// URL to get blocked as mixed content)", async () => {
    const res = await fetch(`${base}/api/files/vid1/link`, { headers: auth() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.path).toMatch(/^\/api\/files\/vid1\/stream\?token=/);
    expect(body.expiresInSeconds).toBeGreaterThanOrEqual(4 * 60 * 60);
  });

  it("serves exact byte ranges of a video without the whole file", async () => {
    const { path } = await (await fetch(`${base}/api/files/vid1/link`, { headers: auth() })).json();
    const res = await fetch(`${base}${path}`, { headers: { Range: "bytes=5000-5009" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 5000-5009/10000");
    expect(Buffer.from(await res.arrayBuffer()).equals(VIDEO.subarray(5000, 5010))).toBe(true);

    const full = await fetch(`${base}${path}`);
    expect(full.status).toBe(200);
    expect((await full.arrayBuffer()).byteLength).toBe(10_000);

    const bad = await fetch(`${base}${path}`, { headers: { Range: "bytes=20000-" } });
    expect(bad.status).toBe(416);
  });

  it("never hands out an unconverted Office original", async () => {
    const res = await fetch(`${base}/api/files/ppt1/link`, { headers: auth() });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/still being converted/);
  });

  it("re-checks access on every stream request (deactivated viewer is cut off)", async () => {
    const { path } = await (await fetch(`${base}/api/files/vid1/link`, { headers: auth() })).json();
    db.users[0].status = "INACTIVE";
    const res = await fetch(`${base}${path}`, { headers: { Range: "bytes=0-9" } });
    expect(res.status).toBe(403);
    db.users[0].status = "ACTIVE";
  });

  it("keeps the 403 for a deactivated account instead of masking it as 401", async () => {
    db.users[0].status = "INACTIVE";
    const res = await fetch(`${base}/api/files/vid1/link`, { headers: auth() });
    expect(res.status).toBe(403);
    db.users[0].status = "ACTIVE";
  });
});
