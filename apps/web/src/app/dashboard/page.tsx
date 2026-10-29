'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownRight, ArrowUpRight, BarChart3, BookOpen, CalendarClock, CheckCircle2, FileText, History,
  PlusCircle, Receipt, RefreshCw, Scale, Truck, Users, Wallet, type LucideIcon,
} from 'lucide-react'
import { can, formatTaka } from '@neurobook/shared'
import PageHeader from '@/ui/PageHeader'
import Card from '@/ui/Card'
import RoleNotice from '@/ui/RoleNotice'
import Button, { buttonClass } from '@/ui/Button'
import { StatCard, StatGrid } from '@/ui/StatCard'
import { useMe } from '@/ui/useMe'
import { voucherStatusBadge, voucherTypeLabel } from '@/lib/voucher-ui'

interface RecentInvoice {
  id: string
  number: string | null
  type: string
  date: string
  total: number
  status: string
  party: string | null
}

interface RecentVoucher {
  id: string
  sequenceNumber: string | null
  voucherType: string
  date: string
  narration: string
  status: string
}

interface Activity {
  id: string
  action: string
  resourceType: string
  resourceId: string | null
  createdAt: string
}

interface Summary {
  company: { name: string | null; slug: string | null; currency: string; fiscalYearStartMonth: number }
  generatedAt: string
  accounts: number
  parties: { total: number; customers: number; suppliers: number }
  products: {
    total: number
    active: number
    outOfStock: number
    lowStock: number
    stockValue: number
    restock: { id: string; name: string; onHand: number }[]
  }
  vouchers: { total: number; posted: number; draft: number; reversed: number }
  invoices: {
    total: number
    sale: number
    purchase: number
    draft: number
    posted: number
    unpaid: number
    receivables: number
    payables: number
  }
  ledger: { revenue: number; expenses: number; net: number; postedDebit: number; postedCredit: number; balanced: boolean }
  bank: { balance: number }
  periods: { open: number; closed: number; current: { label: string; endDate: string } | null }
  recentInvoices: RecentInvoice[]
  recentVouchers: RecentVoucher[]
  recentActivity: Activity[]
}

const INVOICE_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
  sent: 'bg-blue-50 text-blue-700 ring-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-300',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** A titled card used for each list / group of figures on the dashboard. */
function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string
  icon: LucideIcon
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Icon size={15} className="text-gray-400" aria-hidden />
          {title}
        </h2>
        {action}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </Card>
  )
}

/** A label/value row for the compact count panels. */
function Figure({ label, value, tone = 'text-gray-900', hint }: { label: string; value: React.ReactNode; tone?: string; hint?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-gray-500">
        {label}
        {hint && <span className="ml-1 text-xs text-gray-400">{hint}</span>}
      </span>
      <span className={`tabular-nums text-sm font-semibold ${tone}`}>{value}</span>
    </div>
  )
}

export default function DashboardPage() {
  const me = useMe()
  const [data, setData] = useState<Summary | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [denied, setDenied] = useState(false)

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/dashboard', { cache: 'no-store' })
      if (!res.ok) throw new Error('Could not load the dashboard.')
      const json = await res.json()
      setData(json.data ?? null)
      setStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the dashboard.')
      setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    setDenied(new URLSearchParams(window.location.search).get('denied') === '1')
    void load('initial')
  }, [load])

  const role = me?.role
  const may = (permission: Parameters<typeof can>[1]) => !role || can(role, permission)

  const action = data && (
    <>
      {may('voucher:write') && (
        <Link href="/dashboard/vouchers/new" className={buttonClass('primary')}>
          <PlusCircle size={15} aria-hidden />
          New voucher
        </Link>
      )}
      <Button type="button" variant="outline" onClick={() => load('refresh')} loading={refreshing}>
        {!refreshing && <RefreshCw size={15} aria-hidden />}
        Refresh
      </Button>
    </>
  )

  return (
    <main className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Dashboard"
        description="Live position for the company this session is signed in to."
        badge={
          data?.company.name && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
              {data.company.name}
              {data.company.currency && data.company.currency !== 'BDT' ? ` · ${data.company.currency}` : ''}
            </span>
          )
        }
      >
        {action}
      </PageHeader>

      {denied && (
        <RoleNotice>You do not have permission to open that page. Ask an admin if you need access.</RoleNotice>
      )}

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => load('refresh')} loading={refreshing}>
            Try again
          </Button>
        </div>
      )}

      {status === 'loading' && (
        <StatGrid className="sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[78px] animate-pulse rounded-xl border border-gray-200 bg-gray-100/70" />
          ))}
        </StatGrid>
      )}

      {!data && status === 'error' && (
        <Card className="p-6 text-center">
          <p className="text-sm text-gray-500">The dashboard could not be loaded.</p>
          <Button type="button" className="mt-3" onClick={() => load('initial')} loading={refreshing}>
            Try again
          </Button>
        </Card>
      )}

      {data && (
        <>
          <StatGrid className="sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Cash & bank"
              value={formatTaka(data.bank.balance)}
              icon={Wallet}
              tone={data.bank.balance < 0 ? 'text-red-600' : 'text-gray-900'}
              hint="Opening balances plus statement lines"
            />
            <StatCard
              label="Receivables"
              value={formatTaka(data.invoices.receivables)}
              icon={ArrowDownRight}
              tone="text-blue-600"
              hint={`${data.invoices.unpaid} invoice${data.invoices.unpaid === 1 ? '' : 's'} awaiting payment`}
            />
            <StatCard
              label="Payables"
              value={formatTaka(data.invoices.payables)}
              icon={ArrowUpRight}
              tone="text-amber-600"
              hint="Bills posted but not yet paid"
            />
            <StatCard
              label="Net result"
              value={formatTaka(data.ledger.net)}
              icon={Scale}
              tone={data.ledger.net >= 0 ? 'text-emerald-600' : 'text-red-600'}
              hint={`Revenue ${formatTaka(data.ledger.revenue)} · Expenses ${formatTaka(data.ledger.expenses)}`}
            />
          </StatGrid>

          <Card className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Scale size={15} className="text-gray-400" aria-hidden />
                Posted journals
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                  data.ledger.balanced
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'bg-gray-100 text-gray-600 ring-gray-300'
                }`}
              >
                {data.ledger.balanced ? <CheckCircle2 size={12} aria-hidden /> : <Scale size={12} aria-hidden />}
                {data.ledger.balanced ? 'Debits equal credits' : 'No posted entries yet'}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <div className="text-xs text-gray-500">Debit</div>
                <div className="tabular-nums font-semibold text-gray-900">{formatTaka(data.ledger.postedDebit)}</div>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <div className="text-xs text-gray-500">Credit</div>
                <div className="tabular-nums font-semibold text-gray-900">{formatTaka(data.ledger.postedCredit)}</div>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <div className="text-xs text-gray-500">Revenue</div>
                <div className="tabular-nums font-semibold text-emerald-700">{formatTaka(data.ledger.revenue)}</div>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <div className="text-xs text-gray-500">Expenses</div>
                <div className="tabular-nums font-semibold text-amber-700">{formatTaka(data.ledger.expenses)}</div>
              </div>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Records" icon={BookOpen}>
              <div className="divide-y divide-gray-100">
                <Figure label="Ledger accounts" value={data.accounts} />
                <Figure label="Customers" value={data.parties.customers} />
                <Figure label="Suppliers" value={data.parties.suppliers} />
                <Figure label="Products" value={data.products.total} />
                <Figure
                  label="Vouchers"
                  value={data.vouchers.total}
                  hint={`${data.vouchers.posted} posted · ${data.vouchers.draft} draft`}
                />
                <Figure
                  label="Invoices"
                  value={data.invoices.total}
                  hint={`${data.invoices.sale} sale · ${data.invoices.purchase} purchase`}
                />
              </div>
            </Panel>

            <Panel title="Stock" icon={Truck} action={
              <Link href="/dashboard/stock" className="text-xs font-semibold text-blue-600 hover:underline">
                Manage
              </Link>
            }>
              <div className="divide-y divide-gray-100">
                <Figure label="Stock value" value={formatTaka(data.products.stockValue)} />
                <Figure
                  label="Out of stock"
                  value={data.products.outOfStock}
                  tone={data.products.outOfStock > 0 ? 'text-red-600' : 'text-gray-900'}
                />
                <Figure
                  label="Low stock"
                  value={data.products.lowStock}
                  tone={data.products.lowStock > 0 ? 'text-amber-600' : 'text-gray-900'}
                />
              </div>
              {data.products.restock.length > 0 ? (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Needs restocking</p>
                  <ul className="space-y-1">
                    {data.products.restock.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-gray-700">{p.name}</span>
                        <span className={`tabular-nums text-xs font-semibold ${p.onHand <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                          {p.onHand} on hand
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">All products are well stocked.</p>
              )}
            </Panel>

            <Panel title="Fiscal periods" icon={CalendarClock}>
              <div className="divide-y divide-gray-100">
                <Figure label="Open" value={data.periods.open} tone="text-emerald-700" />
                <Figure label="Closed" value={data.periods.closed} />
                <Figure
                  label="Current period"
                  value={data.periods.current ? data.periods.current.label : '—'}
                  hint={data.periods.current ? `ends ${formatDate(data.periods.current.endDate)}` : undefined}
                />
              </div>
              {!data.periods.current && data.periods.open === 0 && (
                <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
                  No open period — postings may be blocked. Set one up in Settings.
                </p>
              )}
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Recent invoices"
              icon={Receipt}
              action={
                <Link href="/dashboard/invoices" className="text-xs font-semibold text-blue-600 hover:underline">
                  View all
                </Link>
              }
            >
              {data.recentInvoices.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No invoices yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.recentInvoices.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {inv.party ?? 'Walk-in'}
                          <span className="ml-2 font-mono text-xs font-normal text-gray-400">
                            {inv.number ?? inv.id.slice(0, 8)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {inv.type === 'purchase' ? 'Purchase' : 'Sale'} · {formatDate(inv.date)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="tabular-nums text-sm font-semibold text-gray-900">{formatTaka(inv.total)}</span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
                            INVOICE_STATUS_BADGE[inv.status] ?? INVOICE_STATUS_BADGE.draft
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Recent journals"
              icon={FileText}
              action={
                <Link href="/dashboard/vouchers" className="text-xs font-semibold text-blue-600 hover:underline">
                  View all
                </Link>
              }
            >
              {data.recentVouchers.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No vouchers yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.recentVouchers.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/vouchers/${v.id}`}
                          className="truncate text-sm font-medium text-gray-900 hover:text-blue-700 hover:underline"
                        >
                          {voucherTypeLabel(v.voucherType)}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {v.sequenceNumber ? `${v.sequenceNumber} · ` : ''}
                          {formatDate(v.date)}
                          {v.narration ? ` · ${v.narration}` : ''}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${voucherStatusBadge(v.status)}`}
                      >
                        {v.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          

          {may('audit:read') && (
            <Panel
              title="Recent activity"
              icon={History}
              action={
                <Link href="/dashboard/audit" className="text-xs font-semibold text-blue-600 hover:underline">
                  Audit log
                </Link>
              }
            >
              {data.recentActivity.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No activity recorded yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.recentActivity.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <span className="text-sm text-gray-700">
                        <span className="font-medium text-gray-900">{a.action}</span>
                        <span className="ml-2 text-xs text-gray-400">{a.resourceType}</span>
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">{formatWhen(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          <Card className="px-4 py-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <BarChart3 size={15} className="text-gray-400" aria-hidden />
              Quick actions
            </h2>
            <nav className="flex flex-wrap gap-2">
              {may('voucher:write') && (
                <Link href="/dashboard/vouchers/new" className={buttonClass('primary', 'sm')}>
                  <PlusCircle size={14} aria-hidden />
                  New voucher
                </Link>
              )}
              {may('sales:write') && (
                <Link href="/dashboard/sales/new" className={buttonClass('outline', 'sm')}>
                  <ArrowUpRight size={14} aria-hidden />
                  Sales invoice
                </Link>
              )}
              {may('purchase:write') && (
                <Link href="/dashboard/purchases/new" className={buttonClass('outline', 'sm')}>
                  <ArrowDownRight size={14} aria-hidden />
                  Purchase invoice
                </Link>
              )}
              {may('receipt:write') && (
                <Link href="/dashboard/receipts" className={buttonClass('outline', 'sm')}>
                  <Wallet size={14} aria-hidden />
                  Receipts
                </Link>
              )}
              {may('party:write') && (
                <Link href="/dashboard/parties" className={buttonClass('outline', 'sm')}>
                  <Users size={14} aria-hidden />
                  Parties
                </Link>
              )}
              <Link href="/dashboard/reports" className={buttonClass('outline', 'sm')}>
                <BarChart3 size={14} aria-hidden />
                Reports
              </Link>
            </nav>
            {data.generatedAt && (
              <p className="mt-3 text-xs text-gray-400">Figures generated {formatWhen(data.generatedAt)}.</p>
            )}
          </Card>
        </>
      )}
    </main>
  )
}
