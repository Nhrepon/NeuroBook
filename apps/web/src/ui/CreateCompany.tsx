'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CheckCircle2, Plus } from 'lucide-react'
import Field, { FormAlert } from '@/ui/Field'
import Modal from '@/ui/Modal'
import Button from '@/ui/Button'
import { baseSlug } from '@/lib/company-slug'
import { invalidateMe } from '@/ui/useMe'

interface Created {
  id: string
  name: string
  slug: string
  membership: { id: string; email: string; role: string } | null
}

/**
 * Creates a company. ADMIN only — the server re-checks `tenant:manage`.
 *
 * The company password is asked for here because a company nobody can enter is
 * unusable: the switcher refuses to enter one that has no password yet. The
 * creator may also add itself as an ADMIN member, in which case the company shows
 * up under its own companies and in its account list.
 */
export default function CreateCompany() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeTouched, setCodeTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [entering, setEntering] = useState(false)

  const trimmedName = name.trim()
  const preview = baseSlug(code.trim() || trimmedName)
  const ready = trimmedName.length >= 2 && password.length >= 8 && password === confirm

  function reset() {
    setName('')
    setCode('')
    setCodeTouched(false)
    setPassword('')
    setConfirm('')
    setError(null)
    setCreated(null)
    setEntering(false)
    setBusy(false)
  }

  function close() {
    setOpen(false)
    reset()
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          slug: code.trim() || undefined,
          password,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error?.message ?? 'Could not create the company.')
        return
      }
      setCreated(body.data)
      invalidateMe()
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  /** Sign in to the new company straight away; it needs the password either way. */
  async function enterNow() {
    if (!created) return
    setEntering(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug: created.slug, password }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error?.message ?? 'Could not switch into the new company.')
        setEntering(false)
        return
      }
      // Full reload: the tenant lives in the session cookie.
      window.location.href = '/dashboard'
    } catch {
      setError('Network error. Please try again.')
      setEntering(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Plus size={14} aria-hidden />
        New company
      </Button>

      {open && (
        <Modal
          title={
            <span className="flex items-center gap-2">
              <Building2 size={16} className="text-blue-600" aria-hidden />
              {created ? 'Company created' : 'Create a company'}
            </span>
          }
          size="md"
          onClose={close}
          footer={
            created ? (
              <>
                <Button type="button" onClick={enterNow} loading={entering}>
                  {!entering && <Building2 size={14} aria-hidden />}
                  {entering ? 'Switching...' : 'Enter it now'}
                </Button>
                <Button type="button" variant="outline" onClick={close} disabled={entering}>
                  Done
                </Button>
              </>
            ) : (
              <>
                <Button type="submit" form="create-company-form" loading={busy} disabled={!ready}>
                  {!busy && <Plus size={14} aria-hidden />}
                  {busy ? 'Creating...' : 'Create company'}
                </Button>
                <Button type="button" variant="outline" onClick={close} disabled={busy}>
                  Cancel
                </Button>
              </>
            )
          }
        >
          {created ? (
            <>
              <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  <span className="font-semibold">{created.name}</span> is ready with its own chart of accounts.
                  Sign in to it with the code{' '}
                  <span className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">{created.slug}</span> and the
                  company password you just set.
                </span>
              </p>

              {created.membership ? (
                <p className="mt-2 text-xs text-gray-500">
                  You are an ADMIN of {created.slug}, so it also appears in your company list. Because your email now
                  belongs to more than one company, signing in asks for a company code.
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-500">
                  No membership was created. You reach it through <span className="font-medium">Switch company</span>{' '}
                  with its company password, and can add its users from Users &amp; roles.
                </p>
              )}

              {error && <div className="mt-3"><FormAlert message={error} /></div>}
            </>
          ) : (
            <form id="create-company-form" onSubmit={create}>
              <p className="text-xs text-gray-500">
                Adds a new company with its own books, users and company password. Nothing is shared with the company
                you are in now.
              </p>
              <div className="mt-3 space-y-3">
                <Field
                  label="Company name"
                  required
                  placeholder="NeuroBook Ltd."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Field
                  label="Company code"
                  hint={
                    preview
                      ? <>Sign-in and switching use this. Preview: <span className="font-mono">{preview}</span></>
                      : 'Leave it and we derive one from the name.'
                  }
                  placeholder="neurobook-ltd"
                  value={code}
                  onChange={(e) => {
                    setCodeTouched(true)
                    setCode(e.target.value)
                  }}
                />
                {codeTouched && preview !== baseSlug(code) && (
                  <p className="text-xs text-amber-700">Only letters, numbers and dashes survive: {preview}</p>
                )}
                <Field
                  label="Company password"
                  type="password"
                  required
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Field
                  label="Confirm company password"
                  type="password"
                  required
                  placeholder="Repeat it"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />

                <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
                  You are added as this company&apos;s first <span className="font-semibold">ADMIN</span>, so it is
                  ready to open and staff right away. Your login password does not change.
                </p>
              </div>

              {error && <div className="mt-3"><FormAlert message={error} /></div>}
            </form>
          )}
        </Modal>
      )}
    </>
  )
}
