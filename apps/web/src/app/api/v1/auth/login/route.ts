import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { tenants, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { signToken } from '@/lib/jwt'
import { writeAudit } from '@/lib/audit'
import { verifyPassword } from '@/lib/credentials'

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
  const ok = await verifyPassword(password, match?.user.passwordHash)
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
