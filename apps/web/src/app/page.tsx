'use client'

import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const [kpis, setKpis] = useState<any>(null)

  useEffect(() => {
    fetch('/api/v1/dashboard').then((r) => r.json()).then((j) => setKpis(j.data))
  }, [])

  if (!kpis) return <main className="p-6">Loading...</main>

  const posted = kpis.postedVouchers
  const drafts = kpis.drafts

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border rounded p-3">Accounts: {kpis.accounts}</div>
        <div className="border rounded p-3">Vouchers: {kpis.vouchers}</div>
        <div className="border rounded p-3">Posted: {posted}</div>
        <div className="border rounded p-3">Drafts: {drafts}</div>
        <div className="border rounded p-3">Invoices: {kpis.invoices}</div>
        <div className="border rounded p-3">Posted Debit: {kpis.postedDebit}</div>
        <div className="border rounded p-3">Posted Credit: {kpis.postedCredit}</div>
        <div className="border rounded p-3">Balanced: {String(kpis.balanced)}</div>
      </div>
      <p className="mt-4 space-x-2">
        <a href="/vouchers/new" className="text-blue-600 hover:underline">Create voucher</a>
        <a href="/accounts" className="text-blue-600 hover:underline">Manage accounts</a>
        <a href="/invoices" className="text-blue-600 hover:underline">Invoices</a>
        <a href="/reports" className="text-blue-600 hover:underline">Reports</a>
      </p>
    </main>
  )
}
