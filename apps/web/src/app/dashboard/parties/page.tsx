'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Users, X } from 'lucide-react'
import { can, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'
import PageHeader from '@/ui/PageHeader'
import Card from '@/ui/Card'
import RoleNotice from '@/ui/RoleNotice'
import SearchInput from '@/ui/SearchInput'
import DataTable from '@/ui/DataTable'
import Modal from '@/ui/Modal'
import Button from '@/ui/Button'
import { StatCard, StatGrid } from '@/ui/StatCard'

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
      <PageHeader
        icon={Users}
        title="Parties"
        description="Customers and suppliers you trade with, used on invoices and vouchers."
      >
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
      </PageHeader>

      <StatGrid>
        <StatCard label="Total" value={rows.length} />
        <StatCard label="Customers" value={customers} tone="text-blue-600" />
        <StatCard label="Suppliers" value={suppliers} tone="text-violet-600" />
      </StatGrid>

      {role && !canWrite && <RoleNotice>Your role can view parties but not create them.</RoleNotice>}

      {showForm && canWrite && (
        <Card className="mb-5 p-4 sm:p-5">
          <form onSubmit={create}>
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
              <Button type="submit" loading={saving} disabled={!name.trim()}>
                {saving ? 'Saving...' : 'Save party'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {editingId && (
        <Modal
          title="Edit party"
          onClose={() => setEditingId(null)}
          footer={
            <>
              <Button type="button" onClick={saveEdit} loading={editSaving} disabled={!editName.trim()}>
                {editSaving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
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
        </Modal>
      )}

      {error && <FormAlert message={error} />}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, phone or email" className="max-w-sm flex-1" />
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


      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'type', label: 'Type' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' },
          { key: 'actions', label: 'Actions', align: 'right' },
        ]}
        loading={loading}
        loadingLabel="Loading parties..."
        isEmpty={visible.length === 0}
        empty={rows.length === 0 ? 'No parties yet. Create one to bill customers or record supplier bills.' : 'No parties match this search.'}
      >
        {visible.map((row) => (
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
      </DataTable>
    </main>
  )
}
