export interface RateLimiter {
  hit(key: { scope: string; id: string; route: string }, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }>
}
export const RATE_LIMITS = { globalPerTenant: { limit: 300, windowSeconds: 60 }, authPerIp: { limit: 10, windowSeconds: 60 } } as const
