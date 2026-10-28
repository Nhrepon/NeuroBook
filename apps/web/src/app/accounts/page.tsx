'use client'

import { useEffect, useState } from 'react'

export default function AccountsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [type, setType] = useState('ASSET')

  async function load() {
    const res = await fetch('/api/v1/accounts')
    const json = await res.json()
    setRows(json.data ?? [])
  }

  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/v1/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code, type }),
    })
    setName(''); setCode('')
    load()
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Accounts</h1>
      <form onSubmit={create} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option>ASSET</option><option>LIABILITY</option><option>EQUITY</option><option>REVENUE</option><option>EXPENSE</option>
        </select>
        <button type="submit">Add</button>
      </form>
      <ul>
        {rows.map((r) => (<li key={r.id}>{r.code} — {r.name} ({r.type})</li>))}
      </ul>
    </main>
  )
}
