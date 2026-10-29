'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, BookOpen, Building2, CheckCircle2, KeyRound, Loader2, Save, Settings as SettingsIcon, Trash2 } from 'lucide-react'
import { can, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'
import PageHeader from '@/ui/PageHeader'
import RoleNotice from '@/ui/RoleNotice'
import Modal from '@/ui/Modal'
import Button, { buttonClass } from '@/ui/Button'
import FiscalPeriodsPanel from '@/ui/FiscalPeriodsPanel'
import TaxRatesPanel from '@/ui/TaxRatesPanel'
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
  tenantCode: string
  legalName: string | null
  email: string | null
  phone: string | null
  website: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  district: string | null
  postalCode: string | null
  country: string | null
  timezone: string | null
  locale: string | null
  status: string
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

  const [legalName, setLegalName] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('BD')
  const [timezone, setTimezone] = useState('Asia/Dhaka')
  const [locale, setLocale] = useState('en')
  const [status, setStatus] = useState('active')

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
        const t = j.meta?.tenant
        if (t) {
          setLegalName(t.legalName ?? '')
          setCompanyEmail(t.email ?? '')
          setPhone(t.phone ?? '')
          setWebsite(t.website ?? '')
          setAddressLine1(t.addressLine1 ?? '')
          setAddressLine2(t.addressLine2 ?? '')
          setCity(t.city ?? '')
          setDistrict(t.district ?? '')
          setPostalCode(t.postalCode ?? '')
          setCountry(t.country ?? 'BD')
          setTimezone(t.timezone ?? 'Asia/Dhaka')
          setLocale(t.locale ?? 'en')
          setStatus(t.status ?? 'active')
        }
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
          profile: {
            legalName: legalName.trim() || undefined,
            email: companyEmail.trim() || undefined,
            phone: phone.trim() || undefined,
            website: website.trim() || undefined,
            addressLine1: addressLine1.trim() || undefined,
            addressLine2: addressLine2.trim() || undefined,
            city: city.trim() || undefined,
            district: district.trim() || undefined,
            postalCode: postalCode.trim() || undefined,
            country: country.trim() || undefined,
            timezone: timezone.trim() || undefined,
            locale: locale.trim() || undefined,
            status: canManageCompany ? status : undefined,
          },
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

  /** Closes the delete dialog and clears anything typed into it. */
  function closeDelete() {
    setDeleteOpen(false)
    setDeleteCode('')
    setDeleteError(null)
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        description="Company identity, currency, fiscal year and period locks. The company name shows in the sidebar, the switcher and the dashboard; the rest appears on invoices and reports."
      />

      {role && !canWrite && <RoleNotice>Your role can view settings but not change them.</RoleNotice>}

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
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 sm:col-span-2">
              <span>
                Company code <span className="font-mono text-gray-700">{tenant?.tenantCode ?? '—'}</span>
              </span>
              <span aria-hidden>·</span>
              <span>
                Slug <span className="font-mono text-gray-700">{tenant?.slug ?? '—'}</span>
              </span>
              <span className="text-gray-400">Both are set when the company is created and cannot be changed here.</span>
            </p>
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

          <h2 className="mt-6 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Building2 size={15} className="text-gray-400" aria-hidden />
            Contact &amp; details
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Printed on invoices and reports, and used for the company&apos;s local conventions.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Legal name"
              optional
              placeholder="NeuroBook Limited"
              value={legalName}
              disabled={!canWrite}
              onChange={(e) => setLegalName(e.target.value)}
              className="sm:col-span-2"
            />
            <Field
              label="Email"
              optional
              type="email"
              placeholder="accounts@company.com"
              value={companyEmail}
              disabled={!canWrite}
              onChange={(e) => setCompanyEmail(e.target.value)}
            />
            <Field
              label="Phone"
              optional
              placeholder="+880 1XXX XXXXXX"
              value={phone}
              disabled={!canWrite}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Field
              label="Website"
              optional
              placeholder="https://company.com"
              value={website}
              disabled={!canWrite}
              onChange={(e) => setWebsite(e.target.value)}
              className="sm:col-span-2"
            />
            <Field
              label="Address line 1"
              optional
              placeholder="House / road"
              value={addressLine1}
              disabled={!canWrite}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="sm:col-span-2"
            />
            <Field
              label="Address line 2"
              optional
              placeholder="Area"
              value={addressLine2}
              disabled={!canWrite}
              onChange={(e) => setAddressLine2(e.target.value)}
              className="sm:col-span-2"
            />
            <Field
              label="City"
              optional
              placeholder="Dhaka"
              value={city}
              disabled={!canWrite}
              onChange={(e) => setCity(e.target.value)}
            />
            <Field
              label="District"
              optional
              placeholder="Dhaka"
              value={district}
              disabled={!canWrite}
              onChange={(e) => setDistrict(e.target.value)}
            />
            <Field
              label="Postal code"
              optional
              placeholder="1207"
              value={postalCode}
              disabled={!canWrite}
              onChange={(e) => setPostalCode(e.target.value)}
            />
            <Field
              label="Country"
              optional
              placeholder="BD"
              value={country}
              disabled={!canWrite}
              onChange={(e) => setCountry(e.target.value.slice(0, 2).toUpperCase())}
              hint="ISO 3166-1 alpha-2."
            />
            <Field
              label="Time zone"
              optional
              placeholder="Asia/Dhaka"
              value={timezone}
              disabled={!canWrite}
              onChange={(e) => setTimezone(e.target.value)}
              hint="IANA name; affects date handling."
            />
            <div>
              <label htmlFor="locale" className="mb-1.5 block text-sm font-medium text-gray-700">
                Language
              </label>
              <select
                id="locale"
                value={locale}
                disabled={!canWrite}
                onChange={(e) => setLocale(e.target.value)}
                className={controlClass}
              >
                <option value="en">English</option>
                <option value="bn">বাংলা (Bangla)</option>
              </select>
            </div>
            {canManageCompany && (
              <div className="sm:col-span-2">
                <label htmlFor="tenant-status" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Company status
                </label>
                <select
                  id="tenant-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={controlClass}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended — nobody can sign in</option>
                  <option value="archived">Archived</option>
                </select>
                <p className="mt-1.5 text-xs text-gray-400">
                  Suspending blocks sign-in, company switching and any live session for this company.
                </p>
              </div>
            )}
          </div>

          {error && <div className="mt-4"><FormAlert message={error} /></div>}

          {saved && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              <CheckCircle2 size={16} aria-hidden />
              Settings saved. The company name is updated across the app.
            </p>
          )}

          <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
            <Button type="submit" loading={saving} disabled={!valid || !canWrite}>
              {!saving && <Save size={15} aria-hidden />}
              {saving ? 'Saving...' : 'Save settings'}
            </Button>
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
            <Button
              type="submit"
              loading={pwBusy}
              disabled={newPw.length < 8 || newPw !== confirmPw || (companyPasswordSet && currentPw.length === 0)}
            >
              {!pwBusy && <KeyRound size={15} aria-hidden />}
              {pwBusy ? 'Saving...' : companyPasswordSet ? 'Change company password' : 'Set company password'}
            </Button>
          </div>
        </form>
      )}

      <FiscalPeriodsPanel />

      <TaxRatesPanel />

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <BookOpen size={15} className="text-gray-400" aria-hidden />
          Related setup
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Manage the chart of accounts and users from their own screens. Tax rates live above, with the other
          accounting settings.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/dashboard/accounts" className={buttonClass('outline', 'sm')}>
            Chart of accounts
          </Link>
          <Link href="/dashboard/users" className={buttonClass('outline', 'sm')}>
            Users &amp; roles
          </Link>
          <Link href="/dashboard/audit" className={buttonClass('outline', 'sm')}>
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
        <Modal
          title={
            <span className="flex items-center gap-2 text-red-700">
              <AlertTriangle size={17} aria-hidden />
              Delete {tenant.name}?
            </span>
          }
          size="md"
          onClose={closeDelete}
          footer={
            <>
              <Button
                type="submit"
                form="delete-company-form"
                variant="danger"
                loading={deleteBusy}
                disabled={deleteCode.trim().toLowerCase() !== tenant.slug}
              >
                {!deleteBusy && <Trash2 size={14} aria-hidden />}
                {deleteBusy ? 'Deleting...' : 'Delete company permanently'}
              </Button>
              <Button type="button" variant="outline" onClick={closeDelete} disabled={deleteBusy}>
                Cancel
              </Button>
            </>
          }
        >
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <p className="font-semibold">This cannot be undone.</p>
            <p className="mt-1">
              Every record of <span className="font-semibold">{tenant.name}</span> (
              <span className="font-mono text-xs">{tenant.slug}</span>) is erased permanently — users, ledgers,
              vouchers, invoices, payments, settings and its audit log. You are working in this company, so you will be
              signed out.
            </p>
          </div>

          <form id="delete-company-form" onSubmit={deleteCompany} className="mt-3 space-y-3">
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
          </form>
        </Modal>
      )}
    </main>
  )
}
