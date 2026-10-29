'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Building2, CheckCircle2, KeyRound, Loader2, LogIn, Trash2, X } from 'lucide-react'
import Field, { FormAlert } from '@/ui/Field'

interface Company {
  id: string
  name: string
  slug: string
  passwordSet: boolean
  members: number
  current: boolean
  createdAt: string
}

const control =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500'

/**
 * Companies this admin's email belongs to. ADMIN only.
 *
 * One password per company, shared by everyone who switches into it, so this page
 * is where an operator rotates a password it does not know, or switches into one
 * of its companies.
 */
export default function CompaniesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [pwTarget, setPwTarget] = useState<Company | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  const [enterTarget, setEnterTarget] = useState<Company | null>(null)
  const [enterPw, setEnterPw] = useState('')
  const [enterBusy, setEnterBusy] = useState(false)
  const [enterError, setEnterError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)
  const [deleteCode, setDeleteCode] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/v1/tenants')
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      setError(json?.error?.message ?? 'Could not load companies.')
      setLoading(false)
      return
    }
    setRows(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function closePassword() {
    setPwTarget(null)
    setPassword('')
    setConfirm('')
    setPwError(null)
    setPwBusy(false)
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!pwTarget || password.length < 8 || password !== confirm) return
    setPwBusy(true)
    setPwError(null)
    try {
      const res = await fetch('/api/v1/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pwTarget.id, password }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setPwError(body?.error?.message ?? 'Could not change the company password.')
        return
      }
      const name = pwTarget.name
      closePassword()
      setNotice(`Password changed for ${name}. Everyone who switches into ${name} now uses the new password.`)
      load()
    } catch {
      setPwError('Network error. Please try again.')
      setPwBusy(false)
    }
  }

  function closeEnter() {
    setEnterTarget(null)
    setEnterPw('')
    setEnterError(null)
    setEnterBusy(false)
  }

  function closeDelete() {
    setDeleteTarget(null)
    setDeleteCode('')
    setDeleteError(null)
    setDeleteBusy(false)
  }

  /**
   * Deletes the company and everything in it. Only fires once the code has been
   * typed out, so a slip of the mouse cannot wipe a company.
   */
  async function confirmDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!deleteTarget || deleteCode.trim().toLowerCase() !== deleteTarget.slug) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/v1/tenants?id=${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setDeleteError(body?.error?.message ?? 'Could not delete the company.')
        setDeleteBusy(false)
        return
      }
      const done = body.data
      closeDelete()
      if (done.sessionEnded) {
        // The company this session was working in is gone; sign in again.
        window.location.href = '/login?deleted=1'
        return
      }
      setNotice(
        `${done.name} and all of its data (users, ledgers, vouchers, invoices, settings, audit) were deleted.`,
      )
      router.refresh()
      load()
    } catch {
      setDeleteError('Network error. Please try again.')
      setDeleteBusy(false)
    }
  }

  async function enterCompany(e: React.FormEvent) {
    e.preventDefault()
    if (!enterTarget || enterPw.length === 0) return
    setEnterBusy(true)
    setEnterError(null)
    try {
      const res = await fetch('/api/v1/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug: enterTarget.slug, password: enterPw }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setEnterError(body?.error?.message ?? 'Could not switch into that company.')
        setEnterBusy(false)
        return
      }
      // Full reload: the tenant lives in the session cookie.
      window.location.href = '/dashboard'
    } catch {
      setEnterError('Network error. Please try again.')
      setEnterBusy(false)
    }
  }

  if (loading) return <main className="p-6">Loading companies...</main>

  return (
    <main className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <Building2 size={22} className="text-blue-600" aria-hidden />
          Companies
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Companies your email belongs to. Each one has exactly one company password, shared by everyone who switches
          into it — change it here and all of that company&apos;s users get the new one. Only admins can change a
          password.
        </p>
      </header>

      {error && <FormAlert message={error} />}

      {notice && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 size={16} aria-hidden />
          {notice}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Users</th>
              <th className="px-3 py-2">Company password</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <span className="font-semibold text-gray-900">{c.name}</span>
                  {c.current && (
                    <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                      Current
                    </span>
                  )}
                  <span className="ml-2 font-mono text-[11px] text-gray-400">{c.slug}</span>
                </td>
                <td className="px-3 py-2 text-gray-600">{c.members}</td>
                <td className="px-3 py-2">
                  <span className={c.passwordSet ? 'text-emerald-700' : 'text-amber-700'}>
                    {c.passwordSet ? 'Set' : 'Not set — nobody can switch in'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => setPwTarget(c)}
                      className="flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <KeyRound size={13} aria-hidden />
                      Change password
                    </button>
                    {!c.current && (
                      <button
                        onClick={() => setEnterTarget(c)}
                        disabled={!c.passwordSet}
                        title={c.passwordSet ? undefined : 'Set a company password first'}
                        className="flex items-center gap-1 text-gray-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                      >
                        <LogIn size={13} aria-hidden />
                        Switch
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(c)}
                      className="flex items-center gap-1 text-red-600 hover:underline"
                    >
                      <Trash2 size={13} aria-hidden />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Members of a company still sign in with their own password. The company password is only asked for when a
        session moves into that company.
      </p>

      {pwTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-bold text-gray-900">Company password</h2>
              <button
                onClick={closePassword}
                aria-label="Close"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              New password for <span className="font-semibold text-gray-700">{pwTarget.name}</span> (
              <span className="font-mono">{pwTarget.slug}</span>). The current one is not required, and every user of
              this company will use the new one from now on.
            </p>

            <form onSubmit={savePassword} className="mt-3 space-y-3">
              <Field
                label="New company password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <Field
                label="Confirm new password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat it"
              />

              {pwError && <FormAlert message={pwError} />}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closePassword}
                  disabled={pwBusy}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwBusy || password.length < 8 || password !== confirm}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pwBusy && <Loader2 size={14} className="animate-spin" aria-hidden />}
                  {pwBusy ? 'Saving...' : 'Change password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {enterTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-bold text-gray-900">Switch into {enterTarget.name}</h2>
              <button
                onClick={closeEnter}
                aria-label="Close"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Enter the company password for <span className="font-mono">{enterTarget.slug}</span>. This session will
              then work on that company&apos;s books.
            </p>

            <form onSubmit={enterCompany} className="mt-3 space-y-3">
              <label htmlFor="enter-pw" className="mb-1.5 block text-sm font-medium text-gray-700">
                Company password
              </label>
              <input
                id="enter-pw"
                type="password"
                autoFocus
                value={enterPw}
                onChange={(e) => setEnterPw(e.target.value)}
                placeholder="Company password"
                className={control}
              />

              {enterError && <FormAlert message={enterError} />}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEnter}
                  disabled={enterBusy}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enterBusy || enterPw.length === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {enterBusy && <Loader2 size={14} className="animate-spin" aria-hidden />}
                  {enterBusy ? 'Switching...' : 'Switch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-bold text-red-700">
                <AlertTriangle size={17} aria-hidden />
                Delete {deleteTarget.name}?
              </h2>
              <button
                onClick={closeDelete}
                aria-label="Close"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              <p className="font-semibold">This cannot be undone.</p>
              <p className="mt-1">
                Every record of <span className="font-semibold">{deleteTarget.name}</span> (
                <span className="font-mono text-xs">{deleteTarget.slug}</span>) is erased permanently:
              </p>
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs">
                <li>
                  its {deleteTarget.members} user{deleteTarget.members === 1 ? '' : 's'} and their access
                </li>
                <li>chart of accounts, vouchers, journal entries and fiscal periods</li>
                <li>invoices, payments, parties, products, stock and bank data</li>
                <li>company settings, tax rates and the audit log for that company</li>
              </ul>
              {deleteTarget.current && (
                <p className="mt-1.5 font-medium">
                  You are working in this company: deleting it signs this session out, and you will need to sign in again
                  with another company code.
                </p>
              )}
            </div>

            <form onSubmit={confirmDelete} className="mt-3 space-y-3">
              <div>
                <label htmlFor="delete-code" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Type <span className="font-mono text-gray-900">{deleteTarget.slug}</span> to confirm
                </label>
                <input
                  id="delete-code"
                  autoFocus
                  value={deleteCode}
                  onChange={(e) => setDeleteCode(e.target.value)}
                  placeholder={deleteTarget.slug}
                  autoComplete="off"
                  className={control}
                />
              </div>

              {deleteError && <FormAlert message={deleteError} />}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDelete}
                  disabled={deleteBusy}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteBusy || deleteCode.trim().toLowerCase() !== deleteTarget.slug}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {deleteBusy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Trash2 size={14} aria-hidden />}
                  {deleteBusy ? 'Deleting...' : 'Delete company permanently'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
