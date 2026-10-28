import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { tenants, users } from '@/db/schema'
import argon2 from 'argon2'
import { signToken } from '@/lib/jwt'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const companyName = body?.companyName
  const email = body?.email
  const password = body?.password
  if (!companyName || !email || !password) return Response.json({ error: { code: 'VALIDATION', message: 'companyName, email, password required' } }, { status: 400 })

  const [tenant] = await db.insert(tenants).values({ name: companyName }).returning()
  const hash = await argon2.hash(password, { type: argon2.argon2id })
  const [user] = await db.insert(users).values({
    tenantId: tenant.id,
    email,
    passwordHash: hash,
    role: 'ADMIN',
  }).returning()

  const token = await signToken({ sub: user.id, tid: tenant.id, role: user.role })
  const res = Response.json({ data: { accessToken: token, user: { id: user.id, email: user.email, role: user.role } } }, { status: 201 })
  res.headers.set('Set-Cookie', `access_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`)
  return res
}
