import { eq } from 'drizzle-orm'
import { accounts, invoices, journalLines, vouchers } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { requireScope } from '@/controllers/scope'

export async function getDashboardSummary() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const [accs, vs, invs, lines] = await Promise.all([
      tx.select().from(accounts).where(eq(accounts.tenantId, scope.tenantId)),
      tx.select().from(vouchers).where(eq(vouchers.tenantId, scope.tenantId)),
      tx.select().from(invoices).where(eq(invoices.tenantId, scope.tenantId)),
      tx.select().from(journalLines).where(eq(journalLines.tenantId, scope.tenantId)),
    ])

    const postedDebit = lines.reduce((a, l) => a + l.debit, 0)
    const postedCredit = lines.reduce((a, l) => a + l.credit, 0)

    return {
      accounts: accs.length,
      vouchers: vs.length,
      postedVouchers: vs.filter((v) => v.status === 'posted').length,
      drafts: vs.filter((v) => v.status === 'draft').length,
      invoices: invs.length,
      postedDebit,
      postedCredit,
      balanced: postedDebit === postedCredit,
    }
  })
}