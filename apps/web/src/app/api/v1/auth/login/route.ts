import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import argon2 from 'argon2'
import { signToken } from '@/lib/jwt'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email = body?.email
  const password = body?.password
  if (!email || !password) return Response.json({ error: { code: 'VALIDATION', message: 'email and password required' } }, { status: 400 })

  const [user] = await db.select().from(users).where(eq(users.email, email))
  if (!user || !user.active) return Response.json({ error: { code: 'UNAUTHORIZED', message: 'invalid credentials' } }, { status: 401 })
  const ok = await argon2.verify(user.passwordHash, password)
  if (!ok) return Response.json({ error: { code: 'UNAUTHORIZED', message: 'invalid credentials' } }, { status: 401 })

  const token = await signToken({ sub: user.id, tid: user.tenantId, role: user.role })
  const res = Response.json({ data: { accessToken: token, user: { id: user.id, email: user.email, role: user.role } } })
  res.headers.set('Set-Cookie', `access_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`)
  return res
}
