/**
 * Small in-memory fixed-window rate limiter. The API runs as a single
 * process, so there's no need for Redis-backed state here; if it's ever
 * scaled out, swap this for a shared store.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly max: number, private readonly windowMs: number) {}

  /** Seconds until `key` may try again, or 0 if it's under the limit. */
  retryAfter(key: string, now = Date.now()) {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) return 0;
    return entry.count >= this.max ? Math.ceil((entry.resetAt - now) / 1000) : 0;
  }

  hit(key: string, now = Date.now()) {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      entry.count += 1;
    }
    this.prune(now);
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private prune(now: number) {
    if (this.hits.size < 10_000) return;
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key);
    }
  }
}
