import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { tenants, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import argon2 from 'argon2'
import { signToken } from '@/lib/jwt'
import { writeAudit } from '@/lib/audit'

// Valid argon2id hash used only to keep verification timing uniform when the email does not exist.
const DUMMY_HASH = '$argon2id$v=19$m=65536,p=4,t=3$S/6U0ypzke3TlJE6gRlK7g$Ga+IuqLw8GYCGhNj3kxFA5BSfBtMD7XtMaK/qfn3KjM'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')
  const company = body?.company ? String(body.company).trim().toLowerCase() : undefined

  if (!email || !password) {
    return Response.json({ error: { code: 'VALIDATION', message: 'email and password required' } }, { status: 400 })
  }

  const candidates = await db
    .select({ user: users, slug: tenants.slug, tenantName: tenants.name })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(eq(users.email, email))

  let matches = candidates.filter((c) => c.user.active)
  if (company) matches = matches.filter((c) => c.slug === company)

  if (matches.length > 1 && !company) {
    return Response.json(
      { error: { code: 'COMPANY_REQUIRED', message: 'This email belongs to more than one company. Enter your company code.' } },
      { status: 409 },
    )
  }

  const match = matches[0]
  const ok = await argon2.verify(match?.user.passwordHash ?? DUMMY_HASH, password)
  if (!match || !ok) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: 'invalid credentials' } }, { status: 401 })
  }

  const user = match.user
  const token = await signToken({ sub: user.id, tid: user.tenantId, role: user.role })
  const res = Response.json({
    data: {
      accessToken: token,
      user: { id: user.id, email: user.email, role: user.role },
      tenant: { slug: match.slug, name: match.tenantName },
    },
  })
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.headers.set('Set-Cookie', `access_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900${secure}`)

  void writeAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: 'auth.login',
    resourceType: 'user',
    resourceId: user.id,
  }).catch(() => {})

  return res
}
