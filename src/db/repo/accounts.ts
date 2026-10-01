import { db } from '../client'
import { accounts } from '../schema/index'
import { and, eq } from 'drizzle-orm'
import { AccountSchema, type Account } from '@neurobook/shared'
import type { RequestScope } from '../scope'

export async function listAccounts(scope: RequestScope) {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.tenantId, scope.tenantId), eq(accounts.active, true)))
    .orderBy(accounts.code)
}

export async function createAccount(scope: RequestScope, input: Omit<Account, 'id' | 'tenantId'>) {
  const parsed = AccountSchema.parse(input)
  // The numeric(tax_rate) column is a string at the Drizzle level; the
  // shared schema uses numbers. Convert on the way in.
  const [row] = await db
    .insert(accounts)
    .values({
      ...parsed,
      tenantId: scope.tenantId,
      taxRate: parsed.taxRate != null ? String(parsed.taxRate) : null,
      taxDeductibleRate: parsed.taxDeductibleRate != null ? String(parsed.taxDeductibleRate) : null,
      taxExemptRate: parsed.taxExemptRate != null ? String(parsed.taxExemptRate) : null,
    })
    .returning()
  return row!
}
