import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { tenants, users, accounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import argon2 from 'argon2'
import { signToken } from '@/lib/jwt'
import { writeAudit } from '@/lib/audit'
import { randomBytes } from 'node:crypto'

function baseSlug(input: string) {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'company'
  )
}

async function uniqueSlug(desired: string) {
  let candidate = baseSlug(desired)
  for (let i = 0; i < 5; i++) {
    const [taken] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, candidate))
    if (!taken) return candidate
    candidate = `${baseSlug(desired).slice(0, 43)}-${randomBytes(3).toString('hex')}`
  }
  return `company-${randomBytes(6).toString('hex')}`
}

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
    const [tenant] = await tx.insert(tenants).values({ name: companyName, slug }).returning()
    const [user] = await tx.insert(users).values({
      tenantId: tenant.id,
      email,
      passwordHash: hash,
      role: 'ADMIN',
    }).returning()

    await tx.insert(accounts).values([
      { tenantId: tenant.id, name: 'Cash', code: '1100', type: 'ASSET' },
      { tenantId: tenant.id, name: 'Accounts Receivable', code: '1200', type: 'ASSET' },
      { tenantId: tenant.id, name: 'VAT Payable', code: '2100', type: 'LIABILITY' },
      { tenantId: tenant.id, name: 'Sales Revenue', code: '4000', type: 'REVENUE' },
      { tenantId: tenant.id, name: 'General Expense', code: '5000', type: 'EXPENSE' },
    ])

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
