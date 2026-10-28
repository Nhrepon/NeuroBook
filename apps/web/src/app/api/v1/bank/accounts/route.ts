import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { bankAccounts } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const Schema = z.object({ name: z.string().min(1), bankName: z.string().optional(), accountNumber: z.string().optional(), openingBalance: z.number().int().optional() })

export async function GET() {
  const scope = await requireScope()
  const rows = await db.select().from(bankAccounts).where(eq(bankAccounts.tenantId, scope.tenantId))
  return Response.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })
  const [row] = await db.insert(bankAccounts).values({
    tenantId: scope.tenantId,
    name: parsed.data.name,
    bankName: parsed.data.bankName ?? null,
    accountNumber: parsed.data.accountNumber ?? null,
    openingBalance: parsed.data.openingBalance ?? 0,
  }).returning()
  return Response.json({ data: row }, { status: 201 })
}
