'use client'

import { useEffect, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { can, type Role } from '@neurobook/shared'
import { FormAlert } from '@/ui/Field'
import PageHeader from '@/ui/PageHeader'
import RoleNotice from '@/ui/RoleNotice'
import Modal from '@/ui/Modal'
import Button from '@/ui/Button'
import { StatCard, StatGrid } from '@/ui/StatCard'
import PartyList, { type Party } from './PartyList'
import PartyForm from './PartyForm'

type FormState = { mode: 'create' } | { mode: 'edit'; party: Party }

export default function PartiesPage() {
  const [rows, setRows] = useState<Party[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/parties', { cache: 'no-store' })
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
    fetch('/api/v1/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data?.role && setRole(j.data.role))
      .catch(() => {})
  }, [])

  const canWrite = role ? can(role, 'party:write') : true
  const customers = rows.filter((r) => r.type === 'CUSTOMER' || r.type === 'BOTH').length
  const suppliers = rows.filter((r) => r.type === 'SUPPLIER' || r.type === 'BOTH').length

  function openCreate() {
    if (!canWrite) return
    setError(null)
    setNotice(null)
    setForm({ mode: 'create' })
  }

  function openEdit(party: Party) {
    setError(null)
    setNotice(null)
    setForm({ mode: 'edit', party })
  }

  async function remove(party: Party) {
    if (!window.confirm(`Delete "${party.name}"? This cannot be undone.`)) return
    setBusyId(party.id)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/v1/parties?id=${encodeURIComponent(party.id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not delete the party.')
        return
      }
      setNotice(`Deleted "${party.name}".`)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  const editingParty = form?.mode === 'edit' ? form.party : null

  return (
    <main className="mx-auto max-w-7xl">
      <PageHeader
        icon={Users}
        title="Parties"
        description="Customers and suppliers you trade with, used on invoices and vouchers."
      >
        <Button type="button" onClick={openCreate} disabled={!canWrite}>
          <Plus size={15} aria-hidden />
          New party
        </Button>
      </PageHeader>

      <StatGrid>
        <StatCard label="Total" value={rows.length} />
        <StatCard label="Customers" value={customers} tone="text-blue-600" />
        <StatCard label="Suppliers" value={suppliers} tone="text-violet-600" />
      </StatGrid>

      {role && !canWrite && <RoleNotice>Your role can view parties but not create them.</RoleNotice>}

      {notice && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {error && <FormAlert message={error} />}

      <PartyList
        rows={rows}
        loading={loading}
        canWrite={canWrite}
        busyId={busyId}
        onEdit={openEdit}
        onDelete={remove}
      />

      {form && (
        <Modal
          title={form.mode === 'create' ? 'New party' : `Edit ${form.party.name}`}
          subtitle={form.mode === 'create' ? 'A customer, a supplier, or both.' : undefined}
          size="lg"
          onClose={() => setForm(null)}
        >
          <PartyForm
            party={editingParty}
            onCancel={() => setForm(null)}
            onSaved={(name, created) => {
              setForm(null)
              setNotice(created ? `Party "${name}" added.` : `Saved "${name}".`)
              void load()
            }}
          />
        </Modal>
      )}
    </main>
  )
}