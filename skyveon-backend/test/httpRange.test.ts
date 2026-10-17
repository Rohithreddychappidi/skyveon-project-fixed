import { describe, expect, it } from "vitest";
import { parseRangeHeader } from "../src/lib/httpRange";

describe("parseRangeHeader", () => {
  it("returns null when there is no Range header", () => {
    expect(parseRangeHeader(undefined, 1000)).toBeNull();
  });

  it("parses explicit, open-ended and suffix ranges", () => {
    expect(parseRangeHeader("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRangeHeader("bytes=500-", 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRangeHeader("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
  });

  it("clamps an end past the file size", () => {
    expect(parseRangeHeader("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
  });

  it("rejects unsatisfiable or malformed ranges", () => {
    expect(parseRangeHeader("bytes=1000-", 1000)).toBe("invalid");
    expect(parseRangeHeader("bytes=50-10", 1000)).toBe("invalid");
    expect(parseRangeHeader("bytes=-", 1000)).toBe("invalid");
    expect(parseRangeHeader("items=0-1", 1000)).toBe("invalid");
    expect(parseRangeHeader("bytes=0-1,5-9", 1000)).toBe("invalid");
  });
});
