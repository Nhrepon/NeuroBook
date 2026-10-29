'use client'

import { useEffect, useState } from 'react'
import { Loader2, Percent, Plus, X } from 'lucide-react'
import { VAT_RATES, can, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'
import Button from '@/ui/Button'

interface TaxRate {
  id: string
  name: string
  /** Basis points: 1500 = 15.00%. */
  rate: number
  kind: string
  active: boolean
}

const controlClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

/** Basis points -> percent string without trailing zeros (1500 -> "15"). */
function bpToPercent(bp: number): string {
  return String(Number((bp / 100).toFixed(2)))
}

function percentToBp(value: string): number {
  return Math.round(Number(value) * 100)
}

const KIND_LABEL: Record<string, string> = {
  vat: 'VAT',
  ait: 'AIT',
  vds: 'VDS',
  customs: 'Customs',
}

/**
 * Tax rates are accounting configuration, so they live in Settings rather than
 * in their own screen. Invoices copy the rate they used, so editing a definition
 * here never rewrites history.
 */
export default function TaxRatesPanel() {
  const [rows, setRows] = useState<TaxRate[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [rate, setRate] = useState('15')
  const [kind, setKind] = useState('vat')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/tax/rates', { cache: 'no-store' })
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
    fetch('/api/v1/auth/me', { cache: 'no-store' })
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
        body: JSON.stringify({ name: name.trim(), rate: percentToBp(rate), kind }),
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

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch('/api/v1/tax/rates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        setError(payload?.error?.message ?? 'Could not update the tax rate.')
        return
      }
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`Delete "${label}"? Invoices that already used it keep their own rate.`)) return
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/v1/tax/rates?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        setError(payload?.error?.message ?? 'Could not delete the tax rate.')
        return
      }
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section id="tax-rates" className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Percent size={15} className="text-gray-400" aria-hidden />
            Tax rates
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            VAT and other rates offered when raising invoices. Invoices keep the rate they were raised with.
          </p>
        </div>
        {canWrite && (
          <Button
            type="button"
            variant={showForm ? 'outline' : 'primary'}
            size="sm"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? <X size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
            {showForm ? 'Cancel' : 'New rate'}
          </Button>
        )}
      </div>

      {showForm && canWrite && (
        <form onSubmit={create} className="mt-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400">Quick fill:</span>
            {VAT_RATES.filter((r) => r > 0).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRate(String(r))}
                className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
              >
                {r}%
              </button>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Button type="submit" size="sm" loading={saving} disabled={!name.trim() || !rateValid}>
              {saving ? 'Saving...' : 'Save rate'}
            </Button>
          </div>
        </form>
      )}

      {error && <div className="mt-3"><FormAlert message={error} /></div>}

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 text-right font-medium">Rate</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Status</th>
              {canWrite && <th className="px-3 py-2 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={canWrite ? 5 : 4} className="px-3 py-8 text-center text-sm text-gray-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                    Loading tax rates...
                  </span>
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 5 : 4} className="px-3 py-8 text-center text-sm text-gray-500">
                  No tax rates yet. Add the VAT rates you charge.
                </td>
              </tr>
            )}
            {!loading && rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/70">
                <td className="px-3 py-2.5 font-medium text-gray-900">{row.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{bpToPercent(row.rate)}%</td>
                <td className="px-3 py-2.5 text-xs font-medium uppercase text-gray-500">
                  {KIND_LABEL[row.kind] ?? row.kind}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      row.active
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : 'bg-gray-100 text-gray-600 ring-gray-300'
                    }`}
                  >
                    {row.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {canWrite && (
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => patch(row.id, { active: !row.active })}
                        className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                      >
                        {row.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => remove(row.id, row.name)}
                        className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
