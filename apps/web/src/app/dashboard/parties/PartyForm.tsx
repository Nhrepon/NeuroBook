'use client'

import { useState } from 'react'
import Field, { FormAlert } from '@/ui/Field'
import Button from '@/ui/Button'
import type { Party, PartyType } from './PartyList'

const controlClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

interface PartyFormProps {
  /** Edit this party; omit (or null) to create a new one. */
  party?: Party | null
  onSaved: (name: string, created: boolean) => void
  onCancel: () => void
}

/** Create or edit a customer/supplier. The page owns the modal and refresh. */
export default function PartyForm({ party, onSaved, onCancel }: PartyFormProps) {
  const editing = Boolean(party)
  const [name, setName] = useState(party?.name ?? '')
  const [type, setType] = useState<PartyType>(party?.type ?? 'CUSTOMER')
  const [phone, setPhone] = useState(party?.phone ?? '')
  const [email, setEmail] = useState(party?.email ?? '')
  const [address, setAddress] = useState(party?.address ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = name.trim()
  const valid = trimmed.length > 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      const body = {
        name: trimmed,
        type,
        phone: phone.trim() || (editing ? null : undefined),
        email: email.trim() || (editing ? null : undefined),
        address: address.trim() || (editing ? null : undefined),
      }
      const res = await fetch('/api/v1/parties', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: party!.id, ...body } : body),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error?.message ?? 'Could not save the party.')
        return
      }
      onSaved(trimmed, !editing)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          required
          autoFocus
          placeholder="Rahim Traders"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div>
          <label htmlFor="party-form-type" className="mb-1.5 block text-sm font-medium text-gray-700">
            Type
          </label>
          <select
            id="party-form-type"
            value={type}
            onChange={(e) => setType(e.target.value as PartyType)}
            className={controlClass}
          >
            <option value="CUSTOMER">Customer</option>
            <option value="SUPPLIER">Supplier</option>
            <option value="BOTH">Customer &amp; supplier</option>
          </select>
        </div>
        <Field label="Phone" optional placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Field label="Email" optional type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Address"
          optional
          placeholder="Dhaka"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="sm:col-span-2"
        />
      </div>

      {error && <FormAlert message={error} />}

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <Button type="submit" loading={busy} disabled={!valid}>
          {busy ? 'Saving...' : editing ? 'Save changes' : 'Save party'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  )
}