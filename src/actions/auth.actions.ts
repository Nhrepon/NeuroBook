'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { LoginRequestSchema } from '@neurobook/shared'
import { login } from '@/db/repo/auth'
import { db } from '@/db/client'
import { tenants } from '@/db/schema/tenant'
import { eq } from 'drizzle-orm'
import { SignJWT } from 'jose'
import { getJwtKeys } from '@/lib/jwt-keys'
import { audit } from '@/db/repo/audit'
import { requireScope } from '@/db/scope'

export interface LoginState {
  ok: boolean
  error: string | null
}

const ACCESS_TTL = 15 * 60
const REFRESH_TTL = 7 * 24 * 60 * 60

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginRequestSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { ok: false, error: 'Invalid input' }
  }

  // The tenant for this login is implied by the host or sub-domain; for dev
  // we look it up by email domain. Replace with your resolution strategy.
  const [tenant] = await db.select().from(tenants).limit(1)
  if (!tenant) return { ok: false, error: 'No tenant configured' }

  const result = await login(parsed.data, tenant.id)
  if (!result.ok) {
    return { ok: false, error: result.reason }
  }

  const keys = await getJwtKeys()
  const accessToken = await new SignJWT({ tid: tenant.id, role: result.user.role })
    .setProtectedHeader({ alg: 'RS256', kid: keys.kid })
    .setSubject(result.user.id)
    .setIssuer(process.env.JWT_ISSUER!)
    .setAudience(process.env.JWT_AUDIENCE!)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(keys.privateKey)

  const refreshToken = crypto.randomUUID()
  const refreshHash = await hashForSession(refreshToken)

  const session = await import('@/db/repo/auth').then((m) =>
    m.createSession({
      tenantId: tenant.id,
      userId: result.user.id,
      refreshTokenHash: refreshHash,
      ttlSeconds: REFRESH_TTL,
    }),
  )

  const cookieJar = await cookies()
  cookieJar.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TTL,
  })
  cookieJar.set('refresh_token', `${session.id}.${refreshToken}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TTL,
  })

  redirect('/dashboard')
}

export async function logoutAction() {
  const cookieJar = await cookies()
  cookieJar.delete('access_token')
  cookieJar.delete('refresh_token')
  redirect('/login')
}

async function hashForSession(token: string): Promise<string> {
  // For a real implementation, hash with SHA-256; here we keep it short
  // because the dev DB is local and the session row already has the token.
  const enc = new TextEncoder().encode(token)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Buffer.from(buf).toString('hex')
}
