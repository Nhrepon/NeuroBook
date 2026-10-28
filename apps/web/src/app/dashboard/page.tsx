'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, BarChart3, BookOpen, CheckCircle2, FileText, Loader2, PlusCircle, Receipt, Scale,
} from 'lucide-react'
import { can, formatTaka, type Role } from '@neurobook/shared'

interface Kpis {
  accounts?: number
  vouchers?: number
  postedVouchers?: number
  drafts?: number
  invoices?: number
  postedDebit?: number
  postedCredit?: number
  balanced?: boolean
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setDenied(new URLSearchParams(window.location.search).get('denied') === '1')
    Promise.all([
      fetch('/api/v1/dashboard').then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load the dashboard.')))),
      fetch('/api/v1/auth/me').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([dash, me]) => {
        setKpis(dash.data ?? {})
        if (me?.data?.role) setRole(me.data.role)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the dashboard.'))
      .finally(() => setLoading(false))
  }, [])

  const cards = [
    { label: 'Ledger accounts', value: kpis?.accounts ?? 0, icon: BookOpen, hint: 'Chart of accounts' },
    { label: 'Vouchers', value: kpis?.vouchers ?? 0, icon: FileText, hint: `${kpis?.postedVouchers ?? 0} posted · ${kpis?.drafts ?? 0} draft` },
    { label: 'Tax invoices', value: kpis?.invoices ?? 0, icon: Receipt, hint: 'Customer invoices' },
    {
      label: 'Posted debit',
      value: formatTaka(kpis?.postedDebit ?? 0),
      icon: Scale,
      hint: `Credit ${formatTaka(kpis?.postedCredit ?? 0)}`,
    },
  ]

  return (
    <main className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Live position for the company this session is signed in to.</p>
        </div>
      </header>

      {denied && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          You do not have permission to open that page. Ask an admin if you need access.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={15} className="animate-spin" aria-hidden />
          Loading dashboard…
        </p>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ label, value, icon: Icon, hint }) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <Icon size={13} className="text-gray-400" aria-hidden />
                  {label}
                </dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums text-gray-900">{value}</dd>
                <p className="mt-0.5 text-xs text-gray-400">{hint}</p>
              </div>
            ))}
          </dl>

          <section className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Scale size={15} className="text-gray-400" aria-hidden />
                Posted journals
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                  kpis?.balanced
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'bg-gray-100 text-gray-600 ring-gray-300'
                }`}
              >
                {kpis?.balanced ? <CheckCircle2 size={12} aria-hidden /> : <Scale size={12} aria-hidden />}
                {kpis?.balanced ? 'Debits equal credits' : 'No posted entries yet'}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <div className="text-xs text-gray-500">Debit</div>
                <div className="tabular-nums font-semibold text-gray-900">{formatTaka(kpis?.postedDebit ?? 0)}</div>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <div className="text-xs text-gray-500">Credit</div>
                <div className="tabular-nums font-semibold text-gray-900">{formatTaka(kpis?.postedCredit ?? 0)}</div>
              </div>
            </div>
          </section>

          <nav className="flex flex-wrap gap-2">
            {(!role || can(role, 'voucher:write')) && (
              <Link
                href="/dashboard/vouchers/new"
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <PlusCircle size={15} aria-hidden />
                New voucher
              </Link>
            )}
            {(!role || can(role, 'invoice:write')) && (
              <Link
                href="/dashboard/invoices"
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                <Receipt size={15} aria-hidden />
                Invoices
              </Link>
            )}
            <Link
              href="/dashboard/reports"
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <BarChart3 size={15} aria-hidden />
              Reports
            </Link>
          </nav>
        </>
      )}
    </main>
  )
}