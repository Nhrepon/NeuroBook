'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Percent, Plus, X } from 'lucide-react'
import { VAT_RATES, can, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'

interface TaxRate {
  id: string
  name: string
  rate: number // basis points (1500 = 15.00%)
  kind: string
  active: boolean
}

const controlClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

/** Basis points -> percent string without trailing zeros (1500 -> "15"). */
function bpToPercent(bp: number): string {
  return String(Number((bp / 100).toFixed(2)))
}

export default function TaxRatesPage() {
  const [rows, setRows] = useState<TaxRate[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [rate, setRate] = useState('15')
  const [kind, setKind] = useState('vat')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/tax/rates')
      if (!res.ok) throw new Error('Could not load tax rates')
      const json = await res.json()
      setRows(json.data ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tax rates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    fetch('/api/v1/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data?.role && setRole(j.data.role))
      .catch(() => {})
  }, [])

  const canWrite = role ? can(role, 'tax:write') : true

  const rateValue = Number(rate)
  const rateValid = Number.isFinite(rateValue) && rateValue >= 0 && rateValue <= 100

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !rateValid || !canWrite) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/tax/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), rate: Math.round(rateValue * 100), kind }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not save the tax rate.')
        return
      }
      setName('')
      setRate('15')
      setShowForm(false)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <Percent size={22} className="text-blue-600" aria-hidden />
            Tax rates
          </h1>
          <p className="mt-1 text-sm text-gray-500">VAT and other rates available when raising invoices and vouchers.</p>
        </div>

        <button
          type="button"
          onClick={() => canWrite && setShowForm((v) => !v)}
          aria-disabled={!canWrite}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            canWrite ? 'bg-blue-600 text-white hover:bg-blue-700' : 'cursor-not-allowed bg-gray-100 text-gray-400 shadow-none'
          }`}
        >
          {showForm ? <X size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
          {showForm ? 'Cancel' : 'New rate'}
        </button>
      </header>

      {role && !canWrite && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          Your role can view tax rates but not change them.
        </p>
      )}

      {showForm && canWrite && (
        <form onSubmit={create} className="mb-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-900">New tax rate</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Name" required placeholder="VAT 15%" value={name} onChange={(e) => setName(e.target.value)} />
            <Field
              label="Rate (%)"
              required
              inputMode="decimal"
              placeholder="15"
              value={rate}
              onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))}
              hint={rateValid ? 'Stored as basis points.' : 'Enter a value between 0 and 100.'}
            />
            <div>
              <label htmlFor="tax-kind" className="mb-1.5 block text-sm font-medium text-gray-700">
                Kind
              </label>
              <select id="tax-kind" className={controlClass} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="vat">VAT</option>
                <option value="ait">AIT</option>
                <option value="vds">VDS</option>
                <option value="customs">Customs</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400">Quick fill:</span>
            {VAT_RATES.filter((r) => r > 0).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRate(String(r))}
                className="rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
              >
                {r}%
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={!name.trim() || !rateValid || saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {saving ? 'Saving...' : 'Save rate'}
            </button>
          </div>
        </form>
      )}

      {error && <FormAlert message={error} />}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 text-right font-medium">Rate</th>
                <th className="px-4 py-2.5 font-medium">Kind</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Loading tax rates...
                    </span>
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                    No tax rates yet. Add the VAT rates you charge.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{bpToPercent(row.rate)}%</td>
                    <td className="px-4 py-2.5 uppercase text-xs font-medium text-gray-500">{row.kind}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          row.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-100 text-gray-600 ring-gray-300'
                        }`}
                      >
                        {row.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
