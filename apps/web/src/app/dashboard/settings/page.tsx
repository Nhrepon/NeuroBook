'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, BookOpen, CheckCircle2, KeyRound, Loader2, Save, Settings as SettingsIcon, Trash2, X } from 'lucide-react'
import { can, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'
import FiscalPeriodsPanel from '@/ui/FiscalPeriodsPanel'
import { invalidateMe } from '@/ui/useMe'

interface CompanySettings {
  companyName: string
  binNumber: string | null
  tinNumber: string | null
  currency: string | null
  fiscalYearStartMonth: number | null
  logoUrl: string | null
}

interface TenantInfo {
  id: string
  name: string
  slug: string
}

const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'INR', 'AED', 'SAR', 'MYR']

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const controlClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

export default function SettingsPage() {
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  const [companyName, setCompanyName] = useState('')
  const [binNumber, setBinNumber] = useState('')
  const [tinNumber, setTinNumber] = useState('')
  const [currency, setCurrency] = useState('BDT')
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState('7')
  const [logoUrl, setLogoUrl] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [companyPasswordSet, setCompanyPasswordSet] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSaved, setPwSaved] = useState(false)

  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteCode, setDeleteCode] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/v1/settings')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('settings'))))
      .then((j: { data: CompanySettings | null; meta?: { companyPasswordSet?: boolean; tenant?: TenantInfo | null } }) => {
        setCompanyPasswordSet(Boolean(j.meta?.companyPasswordSet))
        setTenant(j.meta?.tenant ?? null)
        if (!j.data) return
        setCompanyName(j.data.companyName ?? '')
        setBinNumber(j.data.binNumber ?? '')
        setTinNumber(j.data.tinNumber ?? '')
        setCurrency(j.data.currency ?? 'BDT')
        setFiscalYearStartMonth(String(j.data.fiscalYearStartMonth ?? 7))
        setLogoUrl(j.data.logoUrl ?? '')
      })
      .catch(() => setError('Could not load the current settings.'))
      .finally(() => setLoading(false))

    fetch('/api/v1/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data?.role && setRole(j.data.role))
      .catch(() => {})
  }, [])

  const canWrite = role ? can(role, 'settings:write') : true
  const canManageCompany = role ? can(role, 'tenant:manage') : false
  const valid = companyName.trim().length > 0

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || !canWrite) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          binNumber: binNumber.trim() || undefined,
          tinNumber: tinNumber.trim() || undefined,
          currency,
          fiscalYearStartMonth: Number(fiscalYearStartMonth),
          logoUrl: logoUrl.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not save the settings.')
        return
      }
      // The company name lives on the tenant, so the shell badge and the
      // server-rendered switch panel have to be rebuilt with the new value.
      invalidateMe()
      router.refresh()
      setSaved(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function saveCompanyPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!canManageCompany) return
    setPwError(null)
    setPwSaved(false)

    if (newPw.length < 8) {
      setPwError('Use at least 8 characters.')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('The two new passwords do not match.')
      return
    }
    if (companyPasswordSet && currentPw.length === 0) {
      setPwError('Enter the current company password.')
      return
    }

    setPwBusy(true)
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw || undefined, newPassword: newPw }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setPwError(body?.error?.message ?? 'Could not change the company password.')
        return
      }
      setCompanyPasswordSet(true)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setPwSaved(true)
    } catch {
      setPwError('Network error. Please try again.')
    } finally {
      setPwBusy(false)
    }
  }

  /**
   * Deletes this company and everything in it, after the code has been typed
   * out. It is the company this session is working in, so the server ends the
   * session and the browser has to sign in again — with another company.
   */
  async function deleteCompany(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant || deleteCode.trim().toLowerCase() !== tenant.slug) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/v1/tenants?id=${encodeURIComponent(tenant.id)}`, { method: 'DELETE' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setDeleteError(body?.error?.message ?? 'Could not delete the company.')
        setDeleteBusy(false)
        return
      }
      window.location.href = '/login?deleted=1'
    } catch {
      setDeleteError('Network error. Please try again.')
      setDeleteBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <SettingsIcon size={22} className="text-blue-600" aria-hidden />
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Company identity, currency, fiscal year and period locks. The company name shows in the sidebar, the switcher
          and the dashboard; the rest appears on invoices and reports.
        </p>
      </header>

      {role && !canWrite && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          Your role can view settings but not change them.
        </p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={15} className="animate-spin" aria-hidden />
          Loading settings...
        </p>
      ) : (
        <form onSubmit={save} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-900">Company profile</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Company name"
              required
              placeholder="NeuroBook Ltd."
              value={companyName}
              disabled={!canWrite}
              onChange={(e) => setCompanyName(e.target.value)}
              className="sm:col-span-2"
            />
            <Field
              label="BIN number"
              optional
              placeholder="000000000-0000"
              value={binNumber}
              disabled={!canWrite}
              onChange={(e) => setBinNumber(e.target.value)}
              hint="Business Identification Number (VAT)."
            />
            <Field
              label="TIN number"
              optional
              placeholder="000000000000"
              value={tinNumber}
              disabled={!canWrite}
              onChange={(e) => setTinNumber(e.target.value)}
              hint="Taxpayer Identification Number."
            />
            <div>
              <label htmlFor="currency" className="mb-1.5 block text-sm font-medium text-gray-700">
                Currency
              </label>
              <select
                id="currency"
                value={currency}
                disabled={!canWrite}
                onChange={(e) => setCurrency(e.target.value)}
                className={controlClass}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-400">Amounts are stored in this currency’s minor units.</p>
            </div>
            <div>
              <label htmlFor="fy-month" className="mb-1.5 block text-sm font-medium text-gray-700">
                Fiscal year starts in
              </label>
              <select
                id="fy-month"
                value={fiscalYearStartMonth}
                disabled={!canWrite}
                onChange={(e) => setFiscalYearStartMonth(e.target.value)}
                className={controlClass}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-400">Bangladesh default is July.</p>
            </div>
            <Field
              label="Logo URL"
              optional
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              disabled={!canWrite}
              onChange={(e) => setLogoUrl(e.target.value)}
              hint="Shown on printed invoices."
              className="sm:col-span-2"
            />
          </div>

          {error && <div className="mt-4"><FormAlert message={error} /></div>}

          {saved && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              <CheckCircle2 size={16} aria-hidden />
              Settings saved. The company name is updated across the app.
            </p>
          )}

          <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={!valid || !canWrite || saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} aria-hidden />}
              {saving ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </form>
      )}

      {role && canManageCompany && (
        <form onSubmit={saveCompanyPassword} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <KeyRound size={15} className="text-gray-400" aria-hidden />
            Company password
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            One password per company: everyone who switches into this company types the same one, and changing it changes
            it for all of them. Only an admin can change it, and your current one is required here. To change another
            company&apos;s password without knowing it, use{' '}
            <Link href="/dashboard/companies" className="font-medium text-blue-600 hover:underline">
              Companies
            </Link>
            .
          </p>

          <p className="mt-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                companyPasswordSet
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-amber-50 text-amber-800 ring-amber-200'
              }`}
            >
              {companyPasswordSet
                ? 'Set — switching into this company is enabled'
                : 'Not set — switching into this company is blocked until you set one'}
            </span>
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {companyPasswordSet && (
              <Field
                label="Current company password"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Required to change it"
                className="sm:col-span-2"
              />
            )}
            <Field
              label="New company password"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="At least 8 characters"
            />
            <Field
              label="Confirm new password"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Repeat it"
            />
          </div>

          {pwError && <div className="mt-4"><FormAlert message={pwError} /></div>}

          {pwSaved && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              <CheckCircle2 size={16} aria-hidden />
              Company password updated. Everyone who switches into this company — other admins, managers and users —
              now uses the new one.
            </p>
          )}

          <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={pwBusy || newPw.length < 8 || newPw !== confirmPw || (companyPasswordSet && currentPw.length === 0)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pwBusy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <KeyRound size={15} aria-hidden />}
              {pwBusy ? 'Saving...' : companyPasswordSet ? 'Change company password' : 'Set company password'}
            </button>
          </div>
        </form>
      )}

      <FiscalPeriodsPanel />

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <BookOpen size={15} className="text-gray-400" aria-hidden />
          Related setup
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Manage the chart of accounts, tax rates and users from their own screens.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/dashboard/accounts" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
            Chart of accounts
          </Link>
          <Link href="/dashboard/tax/rates" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
            Tax rates
          </Link>
          <Link href="/dashboard/users" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
            Users &amp; roles
          </Link>
          <Link href="/dashboard/audit" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
            Audit log
          </Link>
        </div>
      </section>

      {role && canManageCompany && tenant && (
        <section className="rounded-xl border border-red-200 bg-white p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <Trash2 size={15} aria-hidden />
            Danger zone
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Deleting a company erases it permanently. This is the company you are working in now, so deleting it ends
            this session and you sign in again with another company.
          </p>

          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
            <p className="font-semibold">
              Everything belonging to {tenant.name} is deleted, and it cannot be undone:
            </p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>its users and their access</li>
              <li>chart of accounts, vouchers, journal entries and fiscal periods</li>
              <li>invoices, payments, parties, products, stock and bank data</li>
              <li>company settings, tax rates and this company&apos;s audit log</li>
            </ul>
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              <Trash2 size={15} aria-hidden />
              Delete this company
            </button>
            <span className="font-mono text-xs text-gray-400">{tenant.slug}</span>
          </div>
        </section>
      )}

      {deleteOpen && tenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-bold text-red-700">
                <AlertTriangle size={17} aria-hidden />
                Delete {tenant.name}?
              </h2>
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false)
                  setDeleteCode('')
                  setDeleteError(null)
                }}
                aria-label="Close"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              <p className="font-semibold">This cannot be undone.</p>
              <p className="mt-1">
                Every record of <span className="font-semibold">{tenant.name}</span> (
                <span className="font-mono text-xs">{tenant.slug}</span>) is erased permanently — users, ledgers,
                vouchers, invoices, payments, settings and its audit log. You are working in this company, so you will be
                signed out.
              </p>
            </div>

            <form onSubmit={deleteCompany} className="mt-3 space-y-3">
              <div>
                <label htmlFor="delete-company-code" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Type <span className="font-mono text-gray-900">{tenant.slug}</span> to confirm
                </label>
                <input
                  id="delete-company-code"
                  autoFocus
                  value={deleteCode}
                  onChange={(e) => setDeleteCode(e.target.value)}
                  placeholder={tenant.slug}
                  autoComplete="off"
                  className={controlClass}
                />
              </div>

              {deleteError && <FormAlert message={deleteError} />}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteOpen(false)
                    setDeleteCode('')
                    setDeleteError(null)
                  }}
                  disabled={deleteBusy}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteBusy || deleteCode.trim().toLowerCase() !== tenant.slug}
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
