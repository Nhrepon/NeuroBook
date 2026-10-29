'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Plus, Search, Users, X } from 'lucide-react'
import { can, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'

type PartyType = 'CUSTOMER' | 'SUPPLIER' | 'BOTH'

interface Party {
  id: string
  name: string
  type: PartyType
  email: string | null
  phone: string | null
  address: string | null
  active: boolean
}

const TYPE_BADGE: Record<PartyType, string> = {
  CUSTOMER: 'bg-blue-50 text-blue-700 ring-blue-200',
  SUPPLIER: 'bg-violet-50 text-violet-700 ring-violet-200',
  BOTH: 'bg-amber-50 text-amber-700 ring-amber-200',
}

const TYPE_LABEL: Record<PartyType, string> = { CUSTOMER: 'Customer', SUPPLIER: 'Supplier', BOTH: 'Customer & supplier' }

export default function PartiesPage() {
  const [rows, setRows] = useState<Party[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<PartyType>('CUSTOMER')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<PartyType>('CUSTOMER')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | PartyType>('ALL')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/parties')
      if (!res.ok) throw new Error('Could not load parties')
      const json = await res.json()
      setRows(json.data ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load parties')
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

  const canWrite = role ? can(role, 'party:write') : true

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => typeFilter === 'ALL' || r.type === typeFilter)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.phone?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, query, typeFilter])

  const customers = rows.filter((r) => r.type === 'CUSTOMER' || r.type === 'BOTH').length
  const suppliers = rows.filter((r) => r.type === 'SUPPLIER' || r.type === 'BOTH').length

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !canWrite) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not save the party.')
        return
      }
      setName('')
      setPhone('')
      setEmail('')
      setAddress('')
      setShowForm(false)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(row: Party) {
    setEditingId(row.id)
    setEditName(row.name)
    setEditType(row.type)
    setEditPhone(row.phone ?? '')
    setEditEmail(row.email ?? '')
    setEditAddress(row.address ?? '')
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return
    setEditSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/parties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          name: editName.trim(),
          type: editType,
          phone: editPhone.trim() === '' ? null : editPhone.trim(),
          email: editEmail.trim() === '' ? null : editEmail.trim(),
          address: editAddress.trim() === '' ? null : editAddress.trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not save the party.')
        return
      }
      setEditingId(null)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteParty(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    setError(null)
    try {
      const res = await fetch(`/api/v1/parties?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not delete the party.')
        return
      }
      await load()
    } catch {
      setError('Network error. Please try again.')
    }
  }

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <Users size={22} className="text-blue-600" aria-hidden />
            Parties
          </h1>
          <p className="mt-1 text-sm text-gray-500">Customers and suppliers you trade with, used on invoices and vouchers.</p>
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
          {showForm ? 'Cancel' : 'New party'}
        </button>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Total</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Customers</p>
          <p className="mt-1 text-xl font-semibold text-blue-600">{customers}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Suppliers</p>
          <p className="mt-1 text-xl font-semibold text-violet-600">{suppliers}</p>
        </div>
      </div>

      {role && !canWrite && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          Your role can view parties but not create them.
        </p>
      )}

      {showForm && canWrite && (
        <form onSubmit={create} className="mb-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-900">New party</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name" required placeholder="Rahim Traders" value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <label htmlFor="party-type" className="mb-1.5 block text-sm font-medium text-gray-700">
                Type
              </label>
              <select
                id="party-type"
                value={type}
                onChange={(e) => setType(e.target.value as PartyType)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              >
                <option value="CUSTOMER">Customer</option>
                <option value="SUPPLIER">Supplier</option>
                <option value="BOTH">Customer &amp; supplier</option>
              </select>
            </div>
            <Field label="Phone" optional placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Field label="Email" optional type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Address" optional placeholder="Dhaka" value={address} onChange={(e) => setAddress(e.target.value)} className="sm:col-span-2" />
          </div>

          <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {saving ? 'Saving...' : 'Save party'}
            </button>
          </div>
        </form>
      )}

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-4 shadow-xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-900">Edit party</h2>
              <button type="button" onClick={() => setEditingId(null)} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={16} aria-hidden /></button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Name" required value={editName} onChange={(e) => setEditName(e.target.value)} />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Type</label>
                <select value={editType} onChange={(e) => setEditType(e.target.value as PartyType)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25">
                  <option value="CUSTOMER">Customer</option>
                  <option value="SUPPLIER">Supplier</option>
                  <option value="BOTH">Customer &amp; supplier</option>
                </select>
              </div>
              <Field label="Phone" optional value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              <Field label="Email" optional type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              <Field label="Address" optional value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="sm:col-span-2" />
            </div>
            <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
              <button type="submit" onClick={saveEdit} disabled={!editName.trim() || editSaving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {editSaving && <Loader2 size={15} className="animate-spin" aria-hidden />}
                {editSaving ? 'Saving...' : 'Save changes'}
              </button>
              <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {error && <FormAlert message={error} />}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25">
          <Search size={15} className="shrink-0 text-gray-400" aria-hidden />
          <input
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-gray-400"
            placeholder="Search name, phone or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search parties"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'ALL' | PartyType)}
          aria-label="Filter by type"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
        >
          <option value="ALL">All types</option>
          <option value="CUSTOMER">Customers</option>
          <option value="SUPPLIER">Suppliers</option>
          <option value="BOTH">Both</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Loading parties...
                    </span>
                  </td>
                </tr>
              )}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    {rows.length === 0 ? 'No parties yet. Create one to bill customers or record supplier bills.' : 'No parties match this search.'}
                  </td>
                </tr>
              )}

              {!loading &&
                visible.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TYPE_BADGE[row.type]}`}>
                        {TYPE_LABEL[row.type]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                      {row.phone || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{row.email || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2.5 text-right">
                      {canWrite && (
                        <div className="flex items-center justify-end gap-3">
                          <button type="button" onClick={() => startEdit(row)} className="text-xs font-semibold text-blue-600 hover:underline">Edit</button>
                          <button type="button" onClick={() => deleteParty(row.id, row.name)} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
                        </div>
                      )}
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
