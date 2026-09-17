/**
 * Rate limiting — §15.2 R14.
 *
 * Two ceilings:
 *   - global: 300/min per tenant, the ceiling the spec states.
 *   - auth: 10/min per IP plus per-user exponential backoff after failures.
 *
 * The per-IP auth ceiling is deliberately NOT lower. Many Bangladeshi offices
 * sit behind a single NAT address, so a hard 5/min would lock out an entire
 * firm at 9am. The per-user backoff is what actually slows a brute-force
 * attack against one account; the IP ceiling is only a coarse stop on
 * distributed spraying.
 *
 * Backed by an in-memory sliding window. Redis replaces this when available
 * (§3.5); the interface is deliberately that of a counter so the swap is
 * mechanical.
 */
export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Epoch ms when the window resets. */
  resetAt: number;
}

interface Bucket {
  hits: number[];
}

const DEFAULT_WINDOW_MS = 60_000;

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number = DEFAULT_WINDOW_MS,
  ) {}

  private prune(bucket: Bucket, now: number): number {
    const cutoff = now - this.windowMs;
    bucket.hits = bucket.hits.filter((t) => t > cutoff);
    return bucket.hits.length;
  }

  /**
   * Record a hit and decide whether it is allowed.
   */
  hit(key: string, now: number = Date.now()): RateLimitResult {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { hits: [] };
      this.buckets.set(key, bucket);
    }
    const count = this.prune(bucket, now);
    if (count >= this.limit) {
      const oldest = bucket.hits[0] ?? now;
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldest + this.windowMs,
      };
    }
    bucket.hits.push(now);
    return {
      allowed: true,
      remaining: this.limit - bucket.hits.length,
      resetAt: now + this.windowMs,
    };
  }

  /** Read the current state without consuming a hit. */
  peek(key: string, now: number = Date.now()): RateLimitResult {
    const bucket = this.buckets.get(key);
    if (!bucket) return { allowed: true, remaining: this.limit, resetAt: now + this.windowMs };
    const count = this.prune(bucket, now);
    return {
      allowed: count < this.limit,
      remaining: Math.max(0, this.limit - count),
      resetAt: (bucket.hits[0] ?? now) + this.windowMs,
    };
  }

  /** Test hook. */
  reset(): void {
    this.buckets.clear();
  }
}

/**
 * Per-user exponential backoff after failed attempts (R14).
 *
 * Doubles with each failure up to a cap, so a guessed password gets
 * progressively more expensive while a user who mistypes twice is barely
 * affected.
 */
export class Backoff {
  private readonly failures = new Map<string, number>();

  constructor(
    private readonly baseMs = 1_000,
    private readonly maxMs = 5 * 60_000,
  ) {}

  recordFailure(key: string): number {
    const n = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, n);
    return Math.min(this.baseMs * 2 ** (n - 1), this.maxMs);
  }

  recordSuccess(key: string): void {
    this.failures.delete(key);
  }

  /** Milliseconds the key must wait before its next attempt. */
  waitMs(key: string): number {
    const n = this.failures.get(key) ?? 0;
    return Math.min(this.baseMs * 2 ** n, this.maxMs);
  }

  reset(): void {
    this.failures.clear();
  }
}

/** Named limiters for the two ceilings R14 specifies. */
export interface RateLimits {
  tenant: RateLimiter;
  authIp: RateLimiter;
  backoff: Backoff;
}

export function createRateLimits(): RateLimits {
  return {
    tenant: new RateLimiter(300),
    authIp: new RateLimiter(10),
    backoff: new Backoff(),
  };
}
