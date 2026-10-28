'use client'

import { useEffect, useState } from 'react'

const TYPE = 'RECEIPT'

export default function ReceiptsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [narration, setNarration] = useState('')

  async function load() {
    const res = await fetch(`/api/v1/vouchers?type=${TYPE}`)
    const json = await res.json()
    setRows(json.data ?? [])
  }

  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/v1/vouchers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), narration, voucherType: TYPE }) })
    setNarration('')
    load()
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Receipts</h1>
      <form onSubmit={create} className="flex gap-2 mb-4">
        <input className="border rounded p-2 flex-1" placeholder="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} />
        <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Add</button>
      </form>
      <ul>{rows.map((r) => <li key={r.id} className="border-b py-2">{r.sequenceNumber ?? r.id.slice(0,8)} — {r.narration} ({r.status})</li>)}</ul>
    </main>
  )
}
