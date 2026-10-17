import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/lib/rateLimit";

describe("RateLimiter", () => {
  it("blocks after max hits within the window and reports the wait", () => {
    const limiter = new RateLimiter(3, 60_000);
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(limiter.retryAfter("k", t0)).toBe(0);
      limiter.hit("k", t0);
    }
    expect(limiter.retryAfter("k", t0 + 1000)).toBe(59);
  });

  it("forgets hits once the window passes, and on reset", () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.hit("a", 0);
    expect(limiter.retryAfter("a", 1)).toBeGreaterThan(0);
    expect(limiter.retryAfter("a", 60_001)).toBe(0);

    limiter.hit("b", 0);
    limiter.reset("b");
    expect(limiter.retryAfter("b", 1)).toBe(0);
  });

  it("tracks keys independently", () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.hit("ip|alice", 0);
    expect(limiter.retryAfter("ip|bob", 1)).toBe(0);
  });
});
