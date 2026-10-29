'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowLeftRight, Building2, Check } from 'lucide-react'
import Modal from '@/ui/Modal'
import Button from '@/ui/Button'

export interface Company {
  id: string
  name: string
  slug: string
  role: string
  current: boolean
}

/**
 * Switches the session to another company this email belongs to.
 *
 * The list is resolved on the server (the panel decides who may see it). Only
 * companies where the signed-in email has a membership row are offered. The
 * target company's password is verified by `POST /api/v1/auth/switch` before a
 * new token is issued. Each company keeps its own password.
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
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <ArrowLeftRight size={14} aria-hidden />
        Switch company
      </Button>

      {open && (
        <Modal
          title={target ? 'Confirm the switch' : 'Switch company'}
          size="sm"
          onClose={close}
          footer={
            target && (
              <>
                <Button type="button" onClick={submit} loading={busy} disabled={password.length === 0}>
                  Switch
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTarget(null)
                    setPassword('')
                    setError(null)
                  }}
                  disabled={busy}
                >
                  <ArrowLeft size={14} aria-hidden />
                  Back
                </Button>
              </>
            )
          }
        >
          {!target ? (
            <>
              <p className="text-xs text-gray-500">
                Pick the company this session should use. Only companies your email belongs to are listed.
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
                          {company.slug} · {company.role}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
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
              <p className="text-xs text-gray-500">
                Enter <span className="font-semibold text-gray-700">{target.name}</span>&apos;s company password. One
                password covers the whole company, so other admins and users use the same one. An admin can set a new
                one from the Companies page.
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
            </>
          )}
        </Modal>
      )}
    </>
  )
}
