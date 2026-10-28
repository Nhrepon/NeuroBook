'use client'

import { useEffect, useState } from 'react'
import { can, type Role } from '@neurobook/shared'

export default function DashboardPage() {
  const [kpis, setKpis] = useState<any>(null)
  const [role, setRole] = useState<Role>('VIEWER')
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDenied(new URLSearchParams(window.location.search).get('denied') === '1')
    Promise.all([
      fetch('/api/v1/dashboard').then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load dashboard')))),
      fetch('/api/v1/auth/me').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([dash, me]) => {
        setKpis(dash.data)
        if (me?.data?.role) setRole(me.data.role)
      })
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <main className="p-6 text-red-600">{error}</main>
  if (!kpis) return <main className="p-6">Loading…</main>

  return (
    <main className="p-6">
      {denied && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You do not have permission to open that page. Ask an admin if you need access.
        </div>
      )}
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border rounded p-3">Accounts: {kpis.accounts}</div>
        <div className="border rounded p-3">Vouchers: {kpis.vouchers}</div>
        <div className="border rounded p-3">Posted: {kpis.postedVouchers}</div>
        <div className="border rounded p-3">Drafts: {kpis.drafts}</div>
        <div className="border rounded p-3">Invoices: {kpis.invoices}</div>
        <div className="border rounded p-3">Posted Debit: {kpis.postedDebit}</div>
        <div className="border rounded p-3">Posted Credit: {kpis.postedCredit}</div>
        <div className="border rounded p-3">Balanced: {String(kpis.balanced)}</div>
      </div>
      <p className="mt-4 space-x-4">
        {can(role, 'voucher:write') && (
          <a href="/dashboard/vouchers/new" className="text-blue-600 hover:underline">Create voucher</a>
        )}
        {can(role, 'account:write') && (
          <a href="/dashboard/accounts" className="text-blue-600 hover:underline">Manage accounts</a>
        )}
        {can(role, 'invoice:write') && (
          <a href="/dashboard/invoices" className="text-blue-600 hover:underline">Invoices</a>
        )}
        <a href="/dashboard/reports" className="text-blue-600 hover:underline">Reports</a>
      </p>
    </main>
  )
}
