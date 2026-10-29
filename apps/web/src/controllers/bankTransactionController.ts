import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { bankTransactions } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { requireScope } from '@/controllers/scope'
import { badRequest } from '@/controllers/errors'

const Schema = z.object({
  bankAccountId: z.string().uuid(),
  date: z.string(),
  description: z.string().optional(),
  amount: z.number().int(),
  type: z.enum(['debit', 'credit']),
})

export async function getAllBankTransactions(bankAccountId?: string | null) {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx.select().from(bankTransactions).where(eq(bankTransactions.tenantId, scope.tenantId))
    return bankAccountId ? rows.filter((r) => r.bankAccountId === bankAccountId) : rows
  })
}

export async function createBankTransaction(input: unknown) {
  const scope = await requireScope()
  const parsed = Schema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx
      .insert(bankTransactions)
      .values({
        tenantId: scope.tenantId,
        bankAccountId: parsed.data.bankAccountId,
        date: new Date(parsed.data.date),
        description: parsed.data.description ?? null,
        amount: parsed.data.amount,
        type: parsed.data.type,
      })
      .returning()
    return row
  })
}