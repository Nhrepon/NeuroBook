'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Check, Loader2, Scale } from 'lucide-react'
import { formatTaka } from '@neurobook/shared'
import { FormAlert } from '@/ui/Field'

type ReportType = 'trial-balance' | 'profit-loss' | 'balance-sheet'

interface TrialBalanceRow {
  accountId: string
  accountName: string
  code: string
  debit: number
  credit: number
}

const TABS: { id: ReportType; label: string }[] = [
  { id: 'trial-balance', label: 'Trial balance' },
  { id: 'profit-loss', label: 'Profit & loss' },
  { id: 'balance-sheet', label: 'Balance sheet' },
]

export default function ReportsPage() {
  const [type, setType] = useState<ReportType>('trial-balance')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/v1/reports/${type}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not build this report'))))
      .then((j) => setData(j.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not build this report'))
      .finally(() => setLoading(false))
  }, [type])

  const tbBalanced =
    type === 'trial-balance' && data?.totals && data.totals.debit === data.totals.credit && data.totals.debit > 0

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <BarChart3 size={22} className="text-blue-600" aria-hidden />
          Reports
        </h1>
        <p className="mt-1 text-sm text-gray-500">Built live from posted journal lines across the company.</p>
      </header>

      <div className="mb-5 inline-flex rounded-lg border border-gray-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
              type === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <FormAlert message={error} />}

      {loading && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={15} className="animate-spin" aria-hidden />
          Building report...
        </p>
      )}

      {!loading && !error && type === 'trial-balance' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Code</th>
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 text-right font-medium">Debit (৳)</th>
                  <th className="px-4 py-2.5 text-right font-medium">Credit (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.rows ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                      No posted entries yet.
                    </td>
                  </tr>
                )}
                {(data?.rows ?? []).map((r: TrialBalanceRow) => (
                  <tr key={r.accountId} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.code}</td>
                    <td className="px-4 py-2.5 text-gray-900">{r.accountName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{r.debit ? formatTaka(r.debit) : ''}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{r.credit ? formatTaka(r.credit) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50 font-semibold text-gray-900">
                <tr>
                  <td colSpan={2} className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Scale size={13} aria-hidden />
                      {tbBalanced ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <Check size={13} aria-hidden />
                          Balanced
                        </span>
                      ) : (
                        'Totals'
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatTaka(data?.totals?.debit ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatTaka(data?.totals?.credit ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && type === 'profit-loss' && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <dl className="divide-y divide-gray-100 text-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-gray-600">Revenue</dt>
              <dd className="tabular-nums font-medium text-gray-900">{formatTaka(data?.revenue ?? 0)}</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-gray-600">Expenses</dt>
              <dd className="tabular-nums font-medium text-gray-900">{formatTaka(data?.expenses ?? 0)}</dd>
            </div>
            <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
              <dt className="font-semibold text-gray-900">Net profit</dt>
              <dd className={`tabular-nums font-semibold ${(data?.net ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatTaka(data?.net ?? 0)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {!loading && !error && type === 'balance-sheet' && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <dl className="divide-y divide-gray-100 text-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-gray-600">Assets</dt>
              <dd className="tabular-nums font-medium text-gray-900">{formatTaka(data?.assets ?? 0)}</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-gray-600">Liabilities</dt>
              <dd className="tabular-nums font-medium text-gray-900">{formatTaka(data?.liabilities ?? 0)}</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-gray-600">Equity</dt>
              <dd className="tabular-nums font-medium text-gray-900">{formatTaka(data?.equity ?? 0)}</dd>
            </div>
            <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
              <dt className="font-semibold text-gray-900">Liabilities + equity</dt>
              <dd className="tabular-nums font-semibold text-gray-900">{formatTaka((data?.liabilities ?? 0) + (data?.equity ?? 0))}</dd>
            </div>
          </dl>
        </div>
      )}
    </main>
  )
}
