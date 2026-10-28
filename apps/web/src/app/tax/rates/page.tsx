'use client'

import { useEffect, useState } from 'react'

export default function TaxRatesPage() {
  const [rows, setRows] = useState<any[]>([])
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')

  async function load() {
    const res = await fetch('/api/v1/tax/rates')
    const json = await res.json()
    setRows(json.data ?? [])
  }

  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/v1/tax/rates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, rate: Number(rate) }) })
    setName(''); setRate('')
    load()
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Tax Rates</h1>
      <form onSubmit={create} className="flex gap-2 mb-4">
        <input className="border rounded p-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border rounded p-2" placeholder="Rate (basis points)" value={rate} onChange={(e) => setRate(e.target.value)} />
        <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Add</button>
      </form>
      <ul>{rows.map((r) => <li key={r.id}>{r.name}: {r.rate} bp ({r.kind})</li>)}</ul>
    </main>
  )
}
