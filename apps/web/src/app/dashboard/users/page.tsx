'use client'

import { useEffect, useState } from 'react'
import { ArrowRightLeft, Loader2, Trash2, UserPlus, X } from 'lucide-react'
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, can, type Role } from '@neurobook/shared'

interface UserRow {
  id: string
  email: string
  role: Role
  active: boolean
  createdAt: string
}

interface Company {
  id: string
  name: string
  slug: string
  current: boolean
}

const control = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500'

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [me, setMe] = useState<{ id: string; role: string; tenantName: string; tenantSlug: string } | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('ACCOUNTANT')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [moving, setMoving] = useState<UserRow | null>(null)
  const [companies, setCompanies] = useState<Company[] | null>(null)
  const [target, setTarget] = useState('')
  const [moveError, setMoveError] = useState<string | null>(null)
  const [moveBusy, setMoveBusy] = useState(false)

  async function load() {
    const [usersRes, meRes] = await Promise.all([fetch('/api/v1/users'), fetch('/api/v1/auth/me')])
    const usersJson = await usersRes.json().catch(() => null)
    const meJson = await meRes.json().catch(() => null)
    setRows(usersJson?.data ?? [])
    setMe(meJson?.data ?? null)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

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

  async function remove(user: UserRow) {
    if (!window.confirm(`Remove ${user.email} from this company? They keep access to any other company.`)) return
    setError(null)
    const res = await fetch(`/api/v1/users?id=${encodeURIComponent(user.id)}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => null)
      setError(j?.error?.message ?? 'could not remove user')
      return
    }
    load()
  }

  async function openMove(user: UserRow) {
    setMoving(user)
    setTarget('')
    setMoveError(null)
    if (companies) return
    const res = await fetch('/api/v1/tenants')
    const json = await res.json().catch(() => null)
    setCompanies(json?.data ?? [])
  }

  async function submitMove() {
    if (!moving || !target) return
    setMoveBusy(true)
    setMoveError(null)
    try {
      const res = await fetch('/api/v1/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: moving.id, tenantId: target }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setMoveError(json?.error?.message ?? 'could not move user')
        return
      }
      const company = companies?.find((c) => c.id === target)
      setMoving(null)
      setCompanies(null)
      setError(`${moving.email} now belongs to ${company?.name ?? 'the selected company'}. They must sign in again.`)
      load()
    } finally {
      setMoveBusy(false)
    }
  }

  if (loading) return <main className="p-6">Loading...</main>

  const canManageTenants = me ? can(me.role, 'tenant:manage') : false

  return (
    <main className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Users &amp; roles</h1>
        <p className="mt-1 text-sm text-gray-500">
          Everyone here belongs to {me?.tenantName ?? 'this company'}
          {me?.tenantSlug && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">{me.tenantSlug}</span>}
          . Roles control what they can do.
        </p>
      </header>

      <form onSubmit={create} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <UserPlus size={15} aria-hidden />
          Add a user to this company
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${control} min-w-52 flex-1`}
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className={`${control} min-w-44 flex-1`}
            placeholder="Temporary password (8+)"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <select className={control} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Adding...' : 'Add user'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">{ROLE_DESCRIPTIONS[role]}</p>
        <p className="mt-1 text-xs text-gray-400">
          Sign-in uses the person&apos;s own password. Switching company later asks for the company password instead.
        </p>
      </form>

      {error && <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
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
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    {u.email} {isMe && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded border border-gray-300 p-1"
                      value={u.role}
                      disabled={isMe}
                      onChange={(e) => patch(u.id, { role: e.target.value as Role })}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <span className={u.active ? 'text-emerald-700' : 'text-gray-400'}>
                      {u.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        disabled={isMe}
                        onClick={() => patch(u.id, { active: !u.active })}
                        className="text-blue-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                      >
                        {u.active ? 'Disable' : 'Enable'}
                      </button>
                      {canManageTenants && (
                        <button
                          disabled={isMe}
                          onClick={() => openMove(u)}
                          className="flex items-center gap-1 text-gray-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                          title="Move to another company"
                        >
                          <ArrowRightLeft size={13} aria-hidden />
                          Move
                        </button>
                      )}
                      <button
                        disabled={isMe}
                        onClick={() => remove(u)}
                        className="flex items-center gap-1 text-red-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                      >
                        <Trash2 size={13} aria-hidden />
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <p className="mb-1 font-medium text-gray-800">What each role can do</p>
        <ul className="space-y-1">
          {ROLES.map((r) => (
            <li key={r}>
              <span className="font-medium">{ROLE_LABELS[r]}:</span> {ROLE_DESCRIPTIONS[r]}
            </li>
          ))}
        </ul>
      </div>

      {moving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-bold text-gray-900">Move user to another company</h2>
              <button
                onClick={() => {
                  setMoving(null)
                  setMoveError(null)
                }}
                aria-label="Close"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {moving.email} loses access to {me?.tenantName ?? 'this company'} and is added to the company you pick.
              Their role stays {ROLE_LABELS[moving.role]}. They are signed out everywhere.
            </p>

            <div className="mt-3 space-y-1.5">
              {companies === null && <p className="text-xs text-gray-400">Loading companies...</p>}
              {(companies ?? [])
                .filter((c) => !c.current)
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setTarget(c.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                      target === c.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-semibold text-gray-900">{c.name}</span>
                    <span className="font-mono text-[11px] text-gray-400">{c.slug}</span>
                  </button>
                ))}
            </div>

            {moveError && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{moveError}</p>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setMoving(null)
                  setMoveError(null)
                }}
                disabled={moveBusy}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitMove}
                disabled={!target || moveBusy}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {moveBusy && <Loader2 size={14} className="animate-spin" aria-hidden />}
                Move user
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}