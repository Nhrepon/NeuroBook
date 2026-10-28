import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { accounts, journalLines, vouchers, invoices } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { eq, and, sql } from 'drizzle-orm'

export async function GET(_req: NextRequest) {
  const scope = await requireScope()
  const [accs, vs, invs, lines] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.tenantId, scope.tenantId)),
    db.select().from(vouchers).where(eq(vouchers.tenantId, scope.tenantId)),
    db.select().from(invoices).where(eq(invoices.tenantId, scope.tenantId)),
    db.select().from(journalLines).where(eq(journalLines.tenantId, scope.tenantId)),
  ])

  const postedDebit = lines.reduce((a, l) => a + l.debit, 0)
  const postedCredit = lines.reduce((a, l) => a + l.credit, 0)

  return Response.json({
    data: {
      accounts: accs.length,
      vouchers: vs.length,
      postedVouchers: vs.filter((v) => v.status === 'posted').length,
      drafts: vs.filter((v) => v.status === 'draft').length,
      invoices: invs.length,
      postedDebit,
      postedCredit,
      balanced: postedDebit === postedCredit,
    },
  })
}
