import type { ByteRange } from "./storage";

/**
 * Parses a single-range `Range: bytes=…` header against a file of
 * `totalSize` bytes. Returns null when there's no header (serve the whole
 * file), or "invalid" when the range can't be satisfied (416).
 */
export function parseRangeHeader(header: string | undefined, totalSize: number): ByteRange | null | "invalid" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return "invalid";

  let start: number;
  let end: number;
  if (match[1] === "") {
    // suffix range: the last N bytes
    const suffix = parseInt(match[2], 10);
    if (suffix === 0) return "invalid";
    start = Math.max(totalSize - suffix, 0);
    end = totalSize - 1;
  } else {
    start = parseInt(match[1], 10);
    end = match[2] === "" ? totalSize - 1 : Math.min(parseInt(match[2], 10), totalSize - 1);
  }

  if (start > end || start >= totalSize) return "invalid";
  return { start, end };
}
