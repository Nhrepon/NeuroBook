// R14: per-route rate limits. The interface is platform-agnostic; the
// storage backend (Redis on web, in-memory on mobile) is injected.
export interface RateLimitKey {
  scope: 'tenant' | 'ip' | 'user'
  id: string
  route: string
}

export interface RateLimitDecision {
  allowed: boolean
  remaining: number
  resetAt: number      // epoch seconds
  retryAfterSeconds?: number
}

export interface RateLimiter {
  hit(key: RateLimitKey, limit: number, windowSeconds: number): Promise<RateLimitDecision>
}

export const RATE_LIMITS = {
  globalPerTenant: { limit: 300, windowSeconds: 60 },
  authPerIp: { limit: 10, windowSeconds: 60 },
} as const
