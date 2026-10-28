import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { companySettings, tenants, users } from '@/db/schema'
import { ensureDefaultChart } from '@/db/chart'
import { uniqueSlug } from '@/lib/slug'
import { eq } from 'drizzle-orm'
import argon2 from 'argon2'
import { signToken } from '@/lib/jwt'
import { writeAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const companyName = String(body?.companyName ?? '').trim()
  const requestedSlug = body?.companySlug ? String(body.companySlug).trim() : ''
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')

  if (!companyName || companyName.length < 2) {
    return Response.json({ error: { code: 'VALIDATION', message: 'company name is required' } }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: { code: 'VALIDATION', message: 'a valid email is required' } }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: { code: 'VALIDATION', message: 'password must be at least 8 characters' } }, { status: 400 })
  }

  const slug = await uniqueSlug(requestedSlug || companyName)
  const hash = await argon2.hash(password, { type: argon2.argon2id })

  const result = await db.transaction(async (tx) => {
    const [tenant] = await tx.insert(tenants).values({ name: companyName, slug, passwordHash: hash }).returning()
    const [user] = await tx.insert(users).values({
      tenantId: tenant.id,
      email,
      passwordHash: hash,
      role: 'ADMIN',
    }).returning()

    // Seed the company profile so Settings opens with the registered name
    // instead of an empty form (which would later blank out `tenants.name`).
    await tx.insert(companySettings).values({ tenantId: tenant.id, companyName })

    await ensureDefaultChart(tenant.id, tx as any)

    await writeAudit(
      {
        tenantId: tenant.id,
        userId: user.id,
        action: 'tenant.create',
        resourceType: 'tenant',
        resourceId: tenant.id,
        after: { name: tenant.name, slug: tenant.slug },
      },
      tx as any,
    )

    return { tenant, user }
  })

  const { tenant, user } = result
  const token = await signToken({ sub: user.id, tid: tenant.id, role: user.role })
  const res = Response.json(
    {
      data: {
        accessToken: token,
        user: { id: user.id, email: user.email, role: user.role },
        tenant: { slug: tenant.slug, name: tenant.name },
      },
    },
    { status: 201 },
  )
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.headers.set('Set-Cookie', `access_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900${secure}`)
  return res
}
