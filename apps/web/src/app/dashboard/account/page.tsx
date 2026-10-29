'use client'

import { useState } from 'react'
import { AlertTriangle, Building2, Loader2, Mail, ShieldCheck, Trash2 } from 'lucide-react'
import { ROLE_LABELS, type Role } from '@neurobook/shared'
import PageHeader from '@/ui/PageHeader'
import Card from '@/ui/Card'
import Modal from '@/ui/Modal'
import Button from '@/ui/Button'
import Field, { FormAlert } from '@/ui/Field'
import { useMe } from '@/ui/useMe'

/**
 * The signed-in person's own account in the current company. Deleting it removes
 * their membership here only; a company the same email also belongs to is left
 * alone. Because the session is signed as this row, deleting it ends the session.
 */
export default function AccountPage() {
  const me = useMe()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setOpen(false)
    setConfirmText('')
    setError(null)
  }

  async function remove(e: React.FormEvent) {
    e.preventDefault()
    if (!me || confirmText.trim().toLowerCase() !== me.email.toLowerCase()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/auth/account', { method: 'DELETE' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error?.message ?? 'Could not delete your account.')
        setBusy(false)
        return
      }
      window.location.href = '/login?deleted=account'
    } catch {
      setError('Network error. Please try again.')
      setBusy(false)
    }
  }

  const roleLabel = me ? (ROLE_LABELS[me.role as Role] ?? me.role) : ''

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="My account"
        description="Your sign-in and role in this company. Deleting your account removes it from this company only."
      />

      {!me ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={15} className="animate-spin" aria-hidden />
          Loading your account...
        </p>
      ) : (
        <>
          <Card className="p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                  <Mail size={13} aria-hidden />
                  Email
                </dt>
                <dd className="mt-1 break-all text-sm text-gray-900">{me.email}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                  <ShieldCheck size={13} aria-hidden />
                  Role
                </dt>
                <dd className="mt-1 text-sm text-gray-900">{roleLabel}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                  <Building2 size={13} aria-hidden />
                  Company
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {me.tenantName} <span className="font-mono text-xs text-gray-400">{me.tenantSlug}</span>
                </dd>
              </div>
            </dl>
          </Card>

          <section className="rounded-xl border border-red-200 bg-white p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <Trash2 size={15} aria-hidden />
              Delete my account
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              This removes your login from {me.tenantName} and signs you out. Your work stays with the company — only
              your access is removed. If your email also belongs to another company, that account is untouched.
            </p>
            <div className="mt-3">
              <Button type="button" variant="danger" onClick={() => { setOpen(true); setError(null) }}>
                <Trash2 size={15} aria-hidden />
                Delete my account
              </Button>
            </div>
          </section>
        </>
      )}

      {open && me && (
        <Modal
          title="Delete my account"
          size="md"
          onClose={close}
          footer={
            <>
              <Button
                type="submit"
                form="delete-account-form"
                variant="danger"
                loading={busy}
                disabled={confirmText.trim().toLowerCase() !== me.email.toLowerCase()}
              >
                {busy ? 'Deleting...' : 'Delete my account'}
              </Button>
              <Button type="button" variant="outline" onClick={close} disabled={busy}>
                Cancel
              </Button>
            </>
          }
        >
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Your membership of <span className="font-semibold">{me.tenantName}</span> is removed and this session
              ends. You will be signed out and must sign in again with another company.
            </span>
          </p>

          <form id="delete-account-form" onSubmit={remove} className="mt-4">
            <Field
              label={`Type your email (${me.email}) to confirm`}
              required
              autoComplete="off"
              spellCheck={false}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={me.email}
            />
          </form>

          {error && <div className="mt-3"><FormAlert message={error} /></div>}
        </Modal>
      )}
    </main>
  )
}
