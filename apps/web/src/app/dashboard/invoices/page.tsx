'use client'

import { useEffect, useState } from 'react'

export default function InvoicesPage() {
  const [rows, setRows] = useState<any[]>([])
  const [customer, setCustomer] = useState('')
  const [total, setTotal] = useState('')
  const [vat, setVat] = useState('')

  async function load() {
    const res = await fetch('/api/v1/invoices')
    const json = await res.json()
    setRows(json.data ?? [])
  }

  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/v1/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: customer, date: new Date().toISOString().slice(0, 10), total: Number(total), vat: Number(vat) }),
    })
    setCustomer(''); setTotal(''); setVat('')
    load()
  }

  async function postInvoice(id: string) {
    // Minimal: requires account ids; prompt
    const ar = prompt('AR account UUID')
    const rev = prompt('Revenue account UUID')
    if (!ar || !rev) return
    const res = await fetch(`/api/v1/invoices/${id}/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arAccountId: ar, revenueAccountId: rev }),
    })
    const json = await res.json()
    if (!res.ok) alert(json?.error?.message ?? 'post failed')
    else alert('Posted: ' + json.data.sequenceNumber)
    load()
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Invoices</h1>
      <form onSubmit={create} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)} />
        <input placeholder="Total (minor)" value={total} onChange={(e) => setTotal(e.target.value)} />
        <input placeholder="VAT (minor)" value={vat} onChange={(e) => setVat(e.target.value)} />
        <button type="submit">Create</button>
      </form>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th>Number</th><th>Date</th><th>Total</th><th>Status</th><th>Action</th><th>PDF</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.number ?? r.id.slice(0, 8)}</td>
              <td>{new Date(r.date).toLocaleDateString()}</td>
              <td>{r.total}</td>
              <td>{r.status}</td>
              <td>{r.status === 'draft' && <button onClick={() => postInvoice(r.id)}>Post</button>}</td>
              <td><a href={`/api/v1/invoices/${r.id}/pdf`} target="_blank" className="text-blue-600 hover:underline">PDF</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}

