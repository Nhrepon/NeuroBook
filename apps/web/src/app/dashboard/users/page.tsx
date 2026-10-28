'use client'

import { useEffect, useState } from 'react'
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from '@neurobook/shared'
import { UserPlus } from 'lucide-react'

interface UserRow {
  id: string
  email: string
  role: Role
  active: boolean
  createdAt: string
}

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [me, setMe] = useState<{ id: string } | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('ACCOUNTANT')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [usersRes, meRes] = await Promise.all([
      fetch('/api/v1/users'),
      fetch('/api/v1/auth/me'),
    ])
    const usersJson = await usersRes.json().catch(() => null)
    const meJson = await meRes.json().catch(() => null)
    setRows(usersJson?.data ?? [])
    setMe(meJson?.data ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/v1/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => null)
      setError(j?.error?.message ?? 'could not create user')
      return
    }
    setEmail('')
    setPassword('')
    setRole('ACCOUNTANT')
    load()
  }

  async function patch(id: string, changes: { role?: Role; active?: boolean }) {
    setError(null)
    const res = await fetch('/api/v1/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...changes }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => null)
      setError(j?.error?.message ?? 'could not update user')
      return
    }
    load()
  }

  if (loading) return <main className="p-6">Loading…</main>

  return (
    <main className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Users &amp; roles</h1>
      <p className="text-sm text-gray-500 mb-6">
        Everyone here belongs to your company only. Roles control what they can do.
      </p>

      <form onSubmit={create} className="mb-8 rounded-lg border p-4 bg-gray-50">
        <h2 className="flex items-center gap-2 font-medium mb-3">
          <UserPlus size={16} /> Add a user
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="flex-1 min-w-52 rounded border p-2"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="flex-1 min-w-44 rounded border p-2"
            placeholder="Temporary password (8+)"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <select
            className="rounded border p-2"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button
            disabled={busy}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Add user'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">{ROLE_DESCRIPTIONS[role]}</p>
        <p className="mt-1 text-xs text-gray-400">
          Share the temporary password with the user and ask them to change it after signing in.
        </p>
      </form>

      {error && <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const isMe = me?.id === u.id
              return (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2">
                    {u.email} {isMe && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded border p-1"
                      value={u.role}
                      disabled={isMe}
                      onChange={(e) => patch(u.id, { role: e.target.value as Role })}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <span className={u.active ? 'text-green-700' : 'text-gray-400'}>
                      {u.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      disabled={isMe}
                      onClick={() => patch(u.id, { active: !u.active })}
                      className="text-blue-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                    >
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-lg border bg-white p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-800 mb-1">What each role can do</p>
        <ul className="space-y-1">
          {ROLES.map((r) => (
            <li key={r}><span className="font-medium">{ROLE_LABELS[r]}:</span> {ROLE_DESCRIPTIONS[r]}</li>
          ))}
        </ul>
      </div>
    </main>
  )
}
