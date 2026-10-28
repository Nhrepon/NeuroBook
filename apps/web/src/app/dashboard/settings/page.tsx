'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, BookOpen, CheckCircle2, KeyRound, Loader2, Save, Settings as SettingsIcon } from 'lucide-react'
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

  useEffect(() => {
    fetch('/api/v1/settings')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('settings'))))
      .then((j: { data: CompanySettings | null; meta?: { companyPasswordSet?: boolean } }) => {
        setCompanyPasswordSet(Boolean(j.meta?.companyPasswordSet))
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

  return (
    <main className="mx-auto max-w-3xl space-y-6">
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
            Asked for when an admin or manager switches into this company from another one. It belongs to the company,
            not to a person, so everyone who may switch into it uses the same password.
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
              Company password updated. Tell the other admins and managers who switch into this company.
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
    </main>
  )
}
