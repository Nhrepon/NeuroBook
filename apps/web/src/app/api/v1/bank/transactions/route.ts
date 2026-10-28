import { NextRequest } from 'next/server'
import { bankTransactions } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const Schema = z.object({
  bankAccountId: z.string().uuid(),
  date: z.string(),
  description: z.string().optional(),
  amount: z.number().int(),
  type: z.enum(['debit', 'credit']),
})

export async function GET(req: NextRequest) {
  const scope = await requireScope()
  const bankAccountId = req.nextUrl.searchParams.get('bankAccountId')
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx.select().from(bankTransactions).where(eq(bankTransactions.tenantId, scope.tenantId))
    return Response.json({ data: bankAccountId ? rows.filter((r) => r.bankAccountId === bankAccountId) : rows })
  })
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx.insert(bankTransactions).values({
      tenantId: scope.tenantId,
      bankAccountId: parsed.data.bankAccountId,
      date: new Date(parsed.data.date),
      description: parsed.data.description ?? null,
      amount: parsed.data.amount,
      type: parsed.data.type,
    }).returning()
    return Response.json({ data: row }, { status: 201 })
  })
}
