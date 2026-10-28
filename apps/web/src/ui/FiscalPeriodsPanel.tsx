'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Lock, LockOpen, Plus, X } from 'lucide-react'
import { can, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'

interface FiscalPeriod {
  id: string
  label: string
  startDate: string
  endDate: string
  status: 'open' | 'closed'
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Fiscal period management, embedded in the settings page. Closing a period
 * locks its vouchers against new postings.
 */
export default function FiscalPeriodsPanel() {
  const [rows, setRows] = useState<FiscalPeriod[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/periods')
      if (!res.ok) throw new Error('Could not load periods')
      const json = await res.json()
      setRows(json.data ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load periods')
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

  const canManage = role ? can(role, 'period:manage') : true
  const dateValid = Boolean(start && end) && start <= end

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim() || !dateValid || !canManage) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), startDate: start, endDate: end }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not create the period.')
        return
      }
      setLabel('')
      setStart('')
      setEnd('')
      setShowForm(false)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(row: FiscalPeriod) {
    if (!canManage) return
    setBusyId(row.id)
    setError(null)
    try {
      const res = await fetch('/api/v1/periods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, status: row.status === 'open' ? 'closed' : 'open' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not change the period.')
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
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Fiscal periods</h2>
          <p className="mt-0.5 text-xs text-gray-500">Closing a period locks its vouchers against new postings.</p>
        </div>
        <button
          type="button"
          onClick={() => canManage && setShowForm((v) => !v)}
          aria-disabled={!canManage}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            canManage ? 'bg-blue-600 text-white hover:bg-blue-700' : 'cursor-not-allowed bg-gray-100 text-gray-400 shadow-none'
          }`}
        >
          {showForm ? <X size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
          {showForm ? 'Cancel' : 'New period'}
        </button>
      </div>

      {role && !canManage && (
        <p className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 sm:px-5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          Your role can view periods but not open or close them.
        </p>
      )}

      {showForm && canManage && (
        <form onSubmit={create} className="border-b border-gray-100 px-4 py-4 sm:px-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Label" required placeholder="FY 2026-27" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Field label="Start date" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
            <Field
              label="End date"
              type="date"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              hint={start && end && start > end ? 'End date must be after the start date.' : undefined}
            />
          </div>
          <div className="mt-4">
            <button
              type="submit"
              disabled={!label.trim() || !dateValid || saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {saving ? 'Saving...' : 'Create period'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="px-4 pt-3 sm:px-5">
          <FormAlert message={error} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium sm:px-5">Label</th>
              <th className="px-4 py-2 font-medium">Start</th>
              <th className="px-4 py-2 font-medium">End</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium sm:px-5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={15} className="animate-spin" aria-hidden />
                    Loading periods...
                  </span>
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No fiscal periods yet.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-2.5 font-medium text-gray-900 sm:px-5">{row.label}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">{fmt(row.startDate)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">{fmt(row.endDate)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        row.status === 'open' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-100 text-gray-600 ring-gray-300'
                      }`}
                    >
                      {row.status === 'open' ? <LockOpen size={11} aria-hidden /> : <Lock size={11} aria-hidden />}
                      {row.status === 'open' ? 'Open' : 'Closed'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 sm:px-5">
                    <button
                      type="button"
                      onClick={() => toggle(row)}
                      disabled={!canManage || busyId === row.id}
                      className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 transition hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                    >
                      {busyId === row.id && <Loader2 size={12} className="animate-spin" aria-hidden />}
                      {row.status === 'open' ? 'Close period' : 'Reopen period'}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
