import { describe, expect, it } from "vitest";
import { createDevtoolsDetector, type WindowMetrics } from "@/components/employee/use-content-protection";

const m = (dw: number, dh: number, extra: Partial<WindowMetrics> = {}): WindowMetrics => ({
  dw, dh, ow: 1440, oh: 900, dpr: 2, ...extra,
});

describe("devtools detector", () => {
  it("ignores browser chrome that was already there at page load (sidebar, bookmarks bar)", () => {
    // 300px side panel + 180px of toolbars: the old absolute check flagged this.
    const step = createDevtoolsDetector(m(300, 180));
    for (let i = 0; i < 5; i++) expect(step(m(300, 180))).toBeNull();
  });

  it("flags a large docked panel opening after load, once it persists for two polls", () => {
    const step = createDevtoolsDetector(m(0, 80));
    expect(step(m(0, 480))).toBeNull(); // first suspicious poll
    expect(step(m(0, 480))).toBe("opened");
    expect(step(m(0, 480))).toBeNull();
    expect(step(m(0, 80))).toBe("closed");
  });

  it("does not trigger on a one-poll blip", () => {
    const step = createDevtoolsDetector(m(0, 80));
    expect(step(m(0, 480))).toBeNull();
    expect(step(m(0, 80))).toBeNull();
    expect(step(m(0, 80))).toBeNull();
  });

  it("re-baselines on zoom and whole-window resizes instead of flagging", () => {
    const step = createDevtoolsDetector(m(0, 80));
    expect(step(m(0, 400, { dpr: 1.5 }))).toBeNull(); // zoomed out
    expect(step(m(0, 400, { dpr: 1.5 }))).toBeNull();
    expect(step(m(0, 400, { dpr: 1.5 }))).toBeNull();
    expect(step(m(0, 300, { oh: 1200 }))).toBeNull(); // window resized
    expect(step(m(0, 300, { oh: 1200 }))).toBeNull();
  });
});
