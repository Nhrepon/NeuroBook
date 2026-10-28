'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Loader2, Plus, Search, X } from 'lucide-react'
import { can, formatTaka, toMinor, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'

interface Account {
  id: string
  name: string
  code: string
  type: AccountType
  parentId: string | null
  isGroup: boolean
  openingBalance: number
}

const TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']

const TYPE_BADGE: Record<AccountType, string> = {
  ASSET: 'bg-blue-50 text-blue-700 ring-blue-200',
  LIABILITY: 'bg-amber-50 text-amber-700 ring-amber-200',
  EQUITY: 'bg-violet-50 text-violet-700 ring-violet-200',
  REVENUE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  EXPENSE: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const controlClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

const emptyForm = { name: '', code: '', type: 'ASSET' as AccountType, parentId: '', isGroup: false, openingTaka: '' }

export default function AccountsPage() {
  const [rows, setRows] = useState<Account[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | AccountType>('ALL')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const canWrite = role ? can(role, 'account:write') : true

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/accounts')
      if (!res.ok) throw new Error('Could not load accounts')
      const json = await res.json()
      setRows(json.data ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load accounts')
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

  const groups = useMemo(() => rows.filter((r) => r.isGroup), [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => typeFilter === 'ALL' || r.type === typeFilter)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [rows, query, typeFilter])

  const totalOpening = useMemo(() => rows.reduce((sum, r) => sum + r.openingBalance, 0), [rows])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    try {
      const res = await fetch('/api/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim(),
          type: form.type,
          parentId: form.parentId || undefined,
          isGroup: form.isGroup,
          openingBalance: form.openingTaka ? toMinor(Number(form.openingTaka)) : 0,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setFormError(body?.error?.message ?? 'Could not create the account.')
        return
      }

      setForm(emptyForm)
      setShowForm(false)
      await load()
    } catch {
      setFormError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <BookOpen size={22} className="text-blue-600" aria-hidden />
            Chart of Accounts
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Ledger accounts for this company. Vouchers post against these codes.
          </p>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {showForm ? <X size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
            {showForm ? 'Cancel' : 'New account'}
          </button>
        )}
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Accounts</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Groups</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{groups.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Opening balances</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{formatTaka(totalOpening)}</p>
        </div>
      </div>

      {showForm && canWrite && (
        <form onSubmit={create} className="mb-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-900">New account</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {formError && (
              <div className="sm:col-span-2">
                <FormAlert message={formError} />
              </div>
            )}

            <Field
              label="Account name"
              placeholder="e.g. Petty Cash"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <Field
              label="Account code"
              placeholder="e.g. 1150"
              required
              autoComplete="off"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />

            <div>
              <label htmlFor="account-type" className="mb-1.5 block text-sm font-medium text-gray-700">
                Type
              </label>
              <select
                id="account-type"
                className={controlClass}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="account-parent" className="mb-1.5 block text-sm font-medium text-gray-700">
                Parent group <span className="text-xs font-normal text-gray-400">optional</span>
              </label>
              <select
                id="account-parent"
                className={controlClass}
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              >
                <option value="">None (top level)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} · {g.name}
                  </option>
                ))}
              </select>
            </div>

            <Field
              label="Opening balance (৳)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.openingTaka}
              onChange={(e) => setForm({ ...form, openingTaka: e.target.value })}
            />

            <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isGroup}
                onChange={(e) => setForm({ ...form, isGroup: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              This is a group (holds sub-accounts, not postable)
            </label>
          </div>

          <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {saving ? 'Creating…' : 'Create account'}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm)
                setFormError(null)
                setShowForm(false)
              }}
              className="text-sm font-medium text-gray-500 transition hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {role && !canWrite && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Your role can view accounts but not create them.
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25">
          <Search size={15} className="shrink-0 text-gray-400" aria-hidden />
          <input
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-gray-400"
            placeholder="Search by name or code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search accounts"
          />
        </div>
        <select
          className={`${controlClass} w-auto`}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'ALL' | AccountType)}
          aria-label="Filter by type"
        >
          <option value="ALL">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {error && <FormAlert message={error} />}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Code</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 text-right font-medium">Opening balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Loading accounts…
                    </span>
                  </td>
                </tr>
              )}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                    {rows.length === 0
                      ? 'No accounts yet. Create one to start posting vouchers.'
                      : 'No accounts match this search.'}
                  </td>
                </tr>
              )}

              {!loading &&
                visible.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{row.code}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-900">{row.name}</span>
                      {row.isGroup && (
                        <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                          Group
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TYPE_BADGE[row.type]}`}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                      {formatTaka(row.openingBalance)}
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
