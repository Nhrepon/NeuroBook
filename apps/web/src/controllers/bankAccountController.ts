import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { bankAccounts } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { requireScope } from '@/controllers/scope'
import { badRequest } from '@/controllers/errors'

const Schema = z.object({
  name: z.string().min(1),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  openingBalance: z.number().int().optional(),
})

export async function getAllBankAccounts() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) =>
    tx.select().from(bankAccounts).where(eq(bankAccounts.tenantId, scope.tenantId)),
  )
}

export async function createBankAccount(input: unknown) {
  const scope = await requireScope()
  const parsed = Schema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx
      .insert(bankAccounts)
      .values({
        tenantId: scope.tenantId,
        name: parsed.data.name,
        bankName: parsed.data.bankName ?? null,
        accountNumber: parsed.data.accountNumber ?? null,
        openingBalance: parsed.data.openingBalance ?? 0,
      })
      .returning()
    return row
  })
}