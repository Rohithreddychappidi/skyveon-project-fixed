import { describe, expect, it } from "vitest";
import { escapeHtml } from "../src/lib/html";
import { isSafeKeySegment, safeExtension } from "../src/lib/storage";

describe("escapeHtml", () => {
  it("neutralises markup in names and titles", () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;"
    );
  });
});

describe("isSafeKeySegment", () => {
  it("allows normal storage keys", () => {
    expect(isSafeKeySegment("2026/09/e45bfa38-fb10-46d1-8215-e8f27638f8b2.png")).toBe(true);
  });

  it("rejects traversal and odd characters", () => {
    expect(isSafeKeySegment("../2026/09/file.pdf")).toBe(false);
    expect(isSafeKeySegment("2026/../../etc/passwd")).toBe(false);
    expect(isSafeKeySegment("a/./b.png")).toBe(false);
    expect(isSafeKeySegment("a b.png")).toBe(false);
  });
});

describe("safeExtension", () => {
  it("keeps plain extensions and drops anything path-like", () => {
    expect(safeExtension("Deck.PPTX")).toBe(".pptx");
    expect(safeExtension("../../evil.sh/x")).toBe("");
    expect(safeExtension("noext")).toBe("");
  });
});
