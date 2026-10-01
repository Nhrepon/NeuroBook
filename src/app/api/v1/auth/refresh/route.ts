import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { RefreshRequestSchema } from '@neurobook/shared'
import { db } from '@/db/client'
import { sessions, users } from '@/db/schema/auth'
import { and, eq } from 'drizzle-orm'
import { SignJWT } from 'jose'
import { getJwtKeys } from '@/lib/jwt-keys'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = RefreshRequestSchema.safeParse(body)
  if (!parsed.success) {
    return err({ code: 'VALIDATION', message: 'Invalid input' }, 400)
  }

  const [sessionId, token] = parsed.data.refreshToken.split('.')
  if (!sessionId || !token) {
    return err({ code: 'UNAUTHORIZED', message: 'Malformed refresh token' }, 401)
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return err({ code: 'UNAUTHORIZED', message: 'Session expired' }, 401)
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
  if (!user) return err({ code: 'UNAUTHORIZED', message: 'User gone' }, 401)

  const keys = await getJwtKeys()
  const accessToken = await new SignJWT({ tid: session.tenantId, role: user.role })
    .setProtectedHeader({ alg: 'RS256', kid: keys.kid })
    .setSubject(user.id)
    .setIssuer(process.env.JWT_ISSUER!)
    .setAudience(process.env.JWT_AUDIENCE!)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(keys.privateKey)

  return ok({ accessToken, expiresIn: 900 })
}
