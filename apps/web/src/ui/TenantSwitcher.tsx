'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowLeftRight, Building2, Check, Loader2, X } from 'lucide-react'

export interface Company {
  id: string
  name: string
  slug: string
  role: string
  /** False when an ADMIN is being offered a company it does not belong to. */
  member: boolean
  current: boolean
}

/**
 * Switches the session to another company.
 *
 * The list is resolved on the server (the panel decides who may see it). For an
 * ADMIN it includes every company on the server; the target company's password is
 * verified by `POST /api/v1/auth/switch` before a new token is issued. Each
 * company keeps its own password.
 */
export default function TenantSwitcher({ companies }: { companies: Company[] }) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<Company | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setOpen(false)
    setTarget(null)
    setPassword('')
    setError(null)
  }

  async function submit() {
    if (!target || password.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug: target.slug, password }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not switch company.')
        return
      }
      // Full reload: the tenant lives in the session cookie, so every cached page
      // and every module-level cache must be rebuilt for the new company.
      window.location.href = '/dashboard'
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
      >
        <ArrowLeftRight size={14} aria-hidden />
        Switch company
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-bold text-gray-900">
                {target ? 'Confirm the switch' : 'Switch company'}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            {!target ? (
              <>
                <p className="mt-1 text-xs text-gray-500">
                  Pick the company this session should use. A company marked <em>Admin access</em> is one you do not
                  belong to — entering it needs that company&apos;s password.
                </p>
                <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
                  {companies.map((company) => (
                    <li key={company.id}>
                      <button
                        type="button"
                        disabled={company.current}
                        onClick={() => {
                          setTarget(company)
                          setPassword('')
                          setError(null)
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                          company.current
                            ? 'cursor-default border-blue-200 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-900">
                            <Building2 size={13} className="shrink-0 text-gray-400" aria-hidden />
                            {company.name}
                          </span>
                          <span className="mt-0.5 block font-mono text-[11px] text-gray-400">
                            {company.slug} · {company.member ? company.role : 'not a member'}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {!company.member && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                              Admin access
                            </span>
                          )}
                          {company.current && (
                            <span className="flex items-center gap-1 text-xs font-medium text-blue-700">
                              <Check size={13} aria-hidden />
                              Current
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs text-gray-500">
                  Enter <span className="font-semibold text-gray-700">{target.name}</span>&apos;s company password. It
                  belongs to the company, not to you, so other admins and managers use the same one.
                </p>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit()
                  }}
                  autoFocus
                  placeholder="Company password"
                  disabled={busy}
                  className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                />

                {error && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTarget(null)
                      setPassword('')
                      setError(null)
                    }}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    <ArrowLeft size={14} aria-hidden />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy || password.length === 0}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
                    Switch
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
