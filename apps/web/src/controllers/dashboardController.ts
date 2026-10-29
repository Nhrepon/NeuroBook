import { desc, eq, sql } from 'drizzle-orm'
import {
  accounts,
  auditLog,
  bankAccounts,
  bankTransactions,
  companySettings,
  fiscalPeriods,
  invoices,
  journalLines,
  parties,
  products,
  stockMovements,
  tenants,
  vouchers,
} from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { can } from '@neurobook/shared'
import { requireScope } from '@/controllers/scope'

/** A product at or below this many units on hand is called out for restocking. */
const LOW_STOCK_THRESHOLD = 5

/** How many recent rows each activity list carries. */
const RECENT_LIMIT = 6

const toInt = (value: unknown): number => Number(value ?? 0) || 0

/**
 * Everything the dashboard shows, in one round-trip. Totals are aggregated in
 * SQL and the activity lists are capped, so the payload stays small no matter
 * how much a company has booked.
 */
export async function getDashboardSummary() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const t = scope.tenantId

    const [
      tenantRows,
      settingsRows,
      accountCountRows,
      partyRows,
      productRows,
      voucherRows,
      invoiceRows,
      ledgerRows,
      stockRows,
      bankOpeningRows,
      bankFlowRows,
      periodRows,
      recentInvoiceRows,
      recentVoucherRows,
      auditRows,
    ] = await Promise.all([
      tx.select({ name: tenants.name, slug: tenants.slug }).from(tenants).where(eq(tenants.id, t)).limit(1),
      tx.select().from(companySettings).where(eq(companySettings.tenantId, t)).limit(1),
      tx.select({ n: sql<number>`count(*)::int` }).from(accounts).where(eq(accounts.tenantId, t)),
      tx
        .select({ type: parties.type, n: sql<number>`count(*)::int` })
        .from(parties)
        .where(eq(parties.tenantId, t))
        .groupBy(parties.type),
      tx
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          costPrice: products.costPrice,
          reorderLevel: products.reorderLevel,
          active: products.active,
        })
        .from(products)
        .where(eq(products.tenantId, t)),
      tx
        .select({ status: vouchers.status, n: sql<number>`count(*)::int` })
        .from(vouchers)
        .where(eq(vouchers.tenantId, t))
        .groupBy(vouchers.status),
      tx
        .select({
          type: invoices.type,
          status: invoices.status,
          n: sql<number>`count(*)::int`,
          total: sql<number>`coalesce(sum(${invoices.total}),0)::bigint`,
        })
        .from(invoices)
        .where(eq(invoices.tenantId, t))
        .groupBy(invoices.type, invoices.status),
      tx
        .select({
          accountType: journalLines.accountType,
          debit: sql<number>`coalesce(sum(${journalLines.debit}),0)::bigint`,
          credit: sql<number>`coalesce(sum(${journalLines.credit}),0)::bigint`,
        })
        .from(journalLines)
        .where(eq(journalLines.tenantId, t))
        .groupBy(journalLines.accountType),
      tx
        .select({
          productId: stockMovements.productId,
          purchased: sql<number>`coalesce(sum(case when ${stockMovements.type} = 'in' then ${stockMovements.quantity} else 0 end),0)::numeric`,
          sold: sql<number>`coalesce(sum(case when ${stockMovements.type} = 'out' then ${stockMovements.quantity} else 0 end),0)::numeric`,
          adjusted: sql<number>`coalesce(sum(case when ${stockMovements.type} = 'adjustment' then ${stockMovements.quantity} else 0 end),0)::numeric`,
        })
        .from(stockMovements)
        .where(eq(stockMovements.tenantId, t))
        .groupBy(stockMovements.productId),
      tx
        .select({ opening: sql<number>`coalesce(sum(${bankAccounts.openingBalance}),0)::bigint` })
        .from(bankAccounts)
        .where(eq(bankAccounts.tenantId, t)),
      tx
        .select({
          net: sql<number>`coalesce(sum(case when ${bankTransactions.type} = 'debit' then ${bankTransactions.amount} else -${bankTransactions.amount} end),0)::bigint`,
        })
        .from(bankTransactions)
        .where(eq(bankTransactions.tenantId, t)),
      tx
        .select({
          label: fiscalPeriods.label,
          status: fiscalPeriods.status,
          startDate: fiscalPeriods.startDate,
          endDate: fiscalPeriods.endDate,
        })
        .from(fiscalPeriods)
        .where(eq(fiscalPeriods.tenantId, t)),
      tx
        .select({
          id: invoices.id,
          number: invoices.number,
          type: invoices.type,
          date: invoices.date,
          total: invoices.total,
          status: invoices.status,
          party: parties.name,
        })
        .from(invoices)
        .leftJoin(parties, eq(parties.id, invoices.customerId))
        .where(eq(invoices.tenantId, t))
        .orderBy(desc(invoices.date), desc(invoices.createdAt))
        .limit(RECENT_LIMIT),
      tx
        .select({
          id: vouchers.id,
          sequenceNumber: vouchers.sequenceNumber,
          voucherType: vouchers.voucherType,
          date: vouchers.date,
          narration: vouchers.narration,
          status: vouchers.status,
        })
        .from(vouchers)
        .where(eq(vouchers.tenantId, t))
        .orderBy(desc(vouchers.date), desc(vouchers.createdAt))
        .limit(RECENT_LIMIT),
      can(scope.role, 'audit:read')
        ? tx
            .select({
              id: auditLog.id,
              action: auditLog.action,
              resourceType: auditLog.resourceType,
              resourceId: auditLog.resourceId,
              createdAt: auditLog.createdAt,
            })
            .from(auditLog)
            .where(eq(auditLog.tenantId, t))
            .orderBy(desc(auditLog.createdAt))
            .limit(RECENT_LIMIT)
        : Promise.resolve([] as { id: string; action: string; resourceType: string; resourceId: string | null; createdAt: Date }[]),
    ])

    // --- Company identity -------------------------------------------------
    const tenant = tenantRows[0]
    const settings = settingsRows[0]
    const company = {
      name: settings?.companyName ?? tenant?.name ?? null,
      slug: tenant?.slug ?? null,
      currency: settings?.currency ?? 'BDT',
      fiscalYearStartMonth: settings?.fiscalYearStartMonth ?? 7,
    }

    // --- Counts -----------------------------------------------------------
    const accountsCount = toInt(accountCountRows[0]?.n)

    const partyCounts = { total: 0, customers: 0, suppliers: 0 }
    for (const r of partyRows) {
      const n = toInt(r.n)
      partyCounts.total += n
      if (r.type === 'CUSTOMER' || r.type === 'BOTH') partyCounts.customers += n
      if (r.type === 'SUPPLIER' || r.type === 'BOTH') partyCounts.suppliers += n
    }

    const voucherCounts = { total: 0, posted: 0, draft: 0, reversed: 0 }
    for (const r of voucherRows) {
      const n = toInt(r.n)
      voucherCounts.total += n
      if (r.status === 'posted') voucherCounts.posted += n
      else if (r.status === 'draft') voucherCounts.draft += n
      else if (r.status === 'reversed') voucherCounts.reversed += n
    }

    const invoiceStats = {
      total: 0,
      sale: 0,
      purchase: 0,
      draft: 0,
      posted: 0,
      unpaid: 0,
      receivables: 0,
      payables: 0,
    }
    for (const r of invoiceRows) {
      const n = toInt(r.n)
      const total = toInt(r.total)
      invoiceStats.total += n
      if (r.type === 'purchase') invoiceStats.purchase += n
      else invoiceStats.sale += n
      if (r.status === 'draft') invoiceStats.draft += n
      if (r.status === 'sent' || r.status === 'paid') invoiceStats.posted += n
      if (r.status === 'sent') {
        invoiceStats.unpaid += n
        if (r.type === 'purchase') invoiceStats.payables += total
        else invoiceStats.receivables += total
      }
    }

    // --- Ledger -----------------------------------------------------------
    let postedDebit = 0
    let postedCredit = 0
    let revenue = 0
    let expenses = 0
    for (const r of ledgerRows) {
      const debit = toInt(r.debit)
      const credit = toInt(r.credit)
      postedDebit += debit
      postedCredit += credit
      if (r.accountType === 'REVENUE') revenue += credit - debit
      else if (r.accountType === 'EXPENSE') expenses += debit - credit
    }
    const balanced = postedDebit === postedCredit && postedDebit > 0

    // --- Stock ------------------------------------------------------------
    const movedMap = new Map(stockRows.map((r) => [r.productId, r]))
    let stockValue = 0
    let outOfStock = 0
    let lowStockCount = 0
    const lowStock: { id: string; name: string; onHand: number }[] = []
    for (const p of productRows) {
      const moved = movedMap.get(p.id)
      const purchased = moved ? toInt(moved.purchased) : 0
      const sold = moved ? toInt(moved.sold) : 0
      const adjusted = moved ? toInt(moved.adjusted) : 0
      const onHand = purchased - sold + adjusted
      const unitValue = p.costPrice > 0 ? p.costPrice : p.price
      stockValue += onHand * unitValue
      const threshold = p.reorderLevel > 0 ? p.reorderLevel : LOW_STOCK_THRESHOLD
      if (onHand <= 0) outOfStock += 1
      else if (onHand <= threshold) lowStockCount += 1
      if (onHand <= threshold) lowStock.push({ id: p.id, name: p.name, onHand })
    }
    lowStock.sort((a, b) => a.onHand - b.onHand)

    const productsSummary = {
      total: productRows.length,
      active: productRows.filter((p) => p.active).length,
      outOfStock,
      lowStock: lowStockCount,
      stockValue,
      restock: lowStock.slice(0, RECENT_LIMIT),
    }

    // --- Bank -------------------------------------------------------------
    const bankBalance = toInt(bankOpeningRows[0]?.opening) + toInt(bankFlowRows[0]?.net)

    // --- Fiscal periods ---------------------------------------------------
    const now = Date.now()
    const openPeriods = periodRows.filter((p) => p.status === 'open')
    const containing = openPeriods.find(
      (p) => new Date(p.startDate).getTime() <= now && new Date(p.endDate).getTime() >= now,
    )
    const currentPeriod =
      containing ?? [...openPeriods].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())[0]
    const periods = {
      open: openPeriods.length,
      closed: periodRows.length - openPeriods.length,
      current: currentPeriod
        ? { label: currentPeriod.label, endDate: new Date(currentPeriod.endDate).toISOString() }
        : null,
    }

    return {
      company,
      generatedAt: new Date().toISOString(),
      accounts: accountsCount,
      parties: partyCounts,
      products: productsSummary,
      vouchers: voucherCounts,
      invoices: invoiceStats,
      ledger: { revenue, expenses, net: revenue - expenses, postedDebit, postedCredit, balanced },
      bank: { balance: bankBalance },
      periods,
      recentInvoices: recentInvoiceRows.map((r) => ({ ...r, date: new Date(r.date).toISOString() })),
      recentVouchers: recentVoucherRows.map((r) => ({ ...r, date: new Date(r.date).toISOString() })),
      recentActivity: auditRows.map((r) => ({ ...r, createdAt: new Date(r.createdAt).toISOString() })),
    }
  })
}
