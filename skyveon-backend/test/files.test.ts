import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { linkTtlSeconds } from "../src/modules/files/files.service";
import { watermarkPdf } from "../src/lib/watermark";

describe("linkTtlSeconds", () => {
  it("outlives even multi-hour videos", () => {
    expect(linkTtlSeconds({ type: "VIDEO", durationSeconds: 19023 })).toBeGreaterThanOrEqual(19023 * 2);
    expect(linkTtlSeconds({ type: "VIDEO", durationSeconds: null })).toBe(4 * 60 * 60);
  });

  it("caps video links at 12 hours and keeps documents short", () => {
    expect(linkTtlSeconds({ type: "VIDEO", durationSeconds: 100_000 })).toBe(12 * 60 * 60);
    expect(linkTtlSeconds({ type: "PDF", durationSeconds: null })).toBe(30 * 60);
  });
});

describe("watermarkPdf", () => {
  it("produces identical bytes for the same viewer and document", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]);
    const input = Buffer.from(await doc.save());
    const viewer = { id: "u1", name: "Test User", email: "t@example.com" };

    const first = await watermarkPdf(input, viewer);
    await new Promise((r) => setTimeout(r, 1100)); // cross a second boundary
    const second = await watermarkPdf(input, viewer);
    expect(first.equals(second)).toBe(true);
  });
});
