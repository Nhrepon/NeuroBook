'use client'

import { useEffect, useState } from 'react'

export default function ProductsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')

  async function load() {
    const res = await fetch('/api/v1/products')
    const json = await res.json()
    setRows(json.data ?? [])
  }

  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/v1/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, sku }) })
    setName(''); setSku('')
    load()
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Products</h1>
      <form onSubmit={create} className="flex gap-2 mb-4">
        <input className="border rounded p-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border rounded p-2" placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
        <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Add</button>
      </form>
      <ul>{rows.map((r) => <li key={r.id}>{r.name} ({r.sku})</li>)}</ul>
    </main>
  )
}

