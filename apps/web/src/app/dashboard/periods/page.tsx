'use client'

import { useEffect, useState } from 'react'

export default function PeriodsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [label, setLabel] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  async function load() {
    const res = await fetch('/api/v1/periods')
    const json = await res.json()
    setRows(json.data ?? [])
  }

  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/v1/periods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, startDate: start, endDate: end }) })
    setLabel(''); setStart(''); setEnd('')
    load()
  }

  async function toggle(id: string, status: string) {
    await fetch('/api/v1/periods', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: status === 'open' ? 'closed' : 'open' }) })
    load()
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Fiscal Periods</h1>
      <form onSubmit={create} className="flex gap-2 mb-4">
        <input className="border rounded p-2" placeholder="Label (FY 2025-26)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input type="date" className="border rounded p-2" value={start} onChange={(e) => setStart(e.target.value)} />
        <input type="date" className="border rounded p-2" value={end} onChange={(e) => setEnd(e.target.value)} />
        <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Add</button>
      </form>
      <ul>{rows.map((r) => (
        <li key={r.id} className="flex items-center gap-2 mb-1">
          <span>{r.label} ({new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}) — {r.status}</span>
          <button onClick={() => toggle(r.id, r.status)} className="px-2 py-1 text-xs border rounded">{r.status === 'open' ? 'Close' : 'Reopen'}</button>
        </li>
      ))}</ul>
    </main>
  )
}

