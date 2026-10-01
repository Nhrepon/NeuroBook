// R11: Argon2id. R13: revocable sessions. The actual hashing happens
// server-side via the `argon2` package; this file wires it to the DB.
import argon2 from 'argon2'
import { db } from '../client'
import { users, sessions } from '../schema/index'
import { and, eq } from 'drizzle-orm'
import { LoginRequestSchema } from '@neurobook/shared'

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id })
}

export async function verifyPassword(encoded: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(encoded, plain)
  } catch {
    return false
  }
}

export async function login(input: unknown, tenantId: string) {
  const { email, password, totp } = LoginRequestSchema.parse(input)
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, email)))
  if (!user || !user.active) return { ok: false as const, reason: 'INVALID_CREDENTIALS' }
  if (!(await verifyPassword(user.passwordHash, password))) {
    return { ok: false as const, reason: 'INVALID_CREDENTIALS' }
  }
  if (user.totpEnabled && !totp) {
    return { ok: false as const, reason: 'TOTP_REQUIRED' }
  }
  return { ok: true as const, user }
}

export async function createSession(args: {
  tenantId: string
  userId: string
  refreshTokenHash: string
  userAgent?: string
  ip?: string
  ttlSeconds: number
}) {
  const [s] = await db
    .insert(sessions)
    .values({
      tenantId: args.tenantId,
      userId: args.userId,
      refreshTokenHash: args.refreshTokenHash,
      userAgent: args.userAgent,
      ip: args.ip,
      expiresAt: new Date(Date.now() + args.ttlSeconds * 1000),
    })
    .returning()
  return s!
}

export async function revokeSession(sessionId: string, tenantId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.tenantId, tenantId)))
}
