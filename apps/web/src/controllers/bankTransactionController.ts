import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { bankAccounts, bankTransactions } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { requireScope } from '@/controllers/scope'
import { badRequest, notFound } from '@/controllers/errors'

const Schema = z.object({
  bankAccountId: z.string().uuid(),
  date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'invalid date'),
  description: z.string().trim().max(500).optional(),
  /** Positive minor units; `type` gives the direction. */
  amount: z.number().int().positive(),
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
  if (!parsed.success) throw badRequest('a bank account, a date, a positive amount and a type are required')

  return withTenant(scope.tenantId, async (tx) => {
    const [account] = await tx
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, parsed.data.bankAccountId), eq(bankAccounts.tenantId, scope.tenantId)))
    if (!account) throw notFound('bank account not found')

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

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'bank_transaction.create',
        resourceType: 'bank_transaction',
        resourceId: row.id,
        after: {
          bankAccountId: row.bankAccountId,
          type: row.type,
          amount: row.amount,
          date: row.date,
        },
      },
      tx,
    )
    return row
  })
}
