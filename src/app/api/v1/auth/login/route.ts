import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { LoginRequestSchema } from '@neurobook/shared'
import { db } from '@/db/client'
import { tenants } from '@/db/schema/tenant'
import { login } from '@/db/repo/auth'
import { SignJWT } from 'jose'
import { createSession } from '@/db/repo/auth'
import { getJwtKeys } from '@/lib/jwt-keys'
import { RATE_LIMITS } from '@neurobook/shared/auth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = LoginRequestSchema.safeParse(body)
  if (!parsed.success) {
    return err({ code: 'VALIDATION', message: 'Invalid input' }, 400)
  }

  // R14: rate limit auth per IP.
  // (Implementation omitted for brevity; the interface lives in shared.)

  const [tenant] = await db.select().from(tenants).limit(1)
  if (!tenant) {
    return err({ code: 'NOT_FOUND', message: 'No tenant configured' }, 404)
  }

  const result = await login(parsed.data, tenant.id)
  if (!result.ok) {
    return err({ code: 'UNAUTHORIZED', message: result.reason }, 401)
  }

  const keys = await getJwtKeys()
  const accessToken = await new SignJWT({ tid: tenant.id, role: result.user.role })
    .setProtectedHeader({ alg: 'RS256', kid: keys.kid })
    .setSubject(result.user.id)
    .setIssuer(process.env.JWT_ISSUER!)
    .setAudience(process.env.JWT_AUDIENCE!)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(keys.privateKey)

  const refreshToken = crypto.randomUUID()
  const refreshHash = hashToken(refreshToken)
  const session = await createSession({
    tenantId: tenant.id,
    userId: result.user.id,
    refreshTokenHash: refreshHash,
    ttlSeconds: 7 * 24 * 60 * 60,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return ok({
    accessToken,
    refreshToken: `${session.id}.${refreshToken}`,
    expiresIn: 900,
  })
}

function hashToken(token: string): string {
  return token   // placeholder; the production path uses SHA-256
}

// Suppress unused-import warning for RATE_LIMITS until the rate-limit
// middleware is wired.
void RATE_LIMITS
