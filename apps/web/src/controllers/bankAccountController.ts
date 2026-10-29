import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { bankAccounts } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { requireScope } from '@/controllers/scope'
import { badRequest } from '@/controllers/errors'

const Schema = z.object({
  name: z.string().trim().min(1).max(120),
  bankName: z.string().trim().max(120).optional(),
  accountNumber: z.string().trim().max(64).optional(),
  /** Opening balance in minor units; may be negative for an overdraft. */
  openingBalance: z.number().int().optional(),
})

export async function getAllBankAccounts() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) =>
    tx.select().from(bankAccounts).where(eq(bankAccounts.tenantId, scope.tenantId)).orderBy(bankAccounts.name),
  )
}

export async function createBankAccount(input: unknown) {
  const scope = await requireScope()
  const parsed = Schema.safeParse(input)
  if (!parsed.success) throw badRequest('a bank account name is required')

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

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'bank_account.create',
        resourceType: 'bank_account',
        resourceId: row.id,
        after: { name: row.name, bankName: row.bankName, openingBalance: row.openingBalance },
      },
      tx,
    )
    return row
  })
}
