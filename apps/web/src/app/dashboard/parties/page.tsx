'use client'

import { useEffect, useState } from 'react'

export default function PartiesPage() {
  const [rows, setRows] = useState<any[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState('CUSTOMER')
  const [phone, setPhone] = useState('')

  async function load() {
    const res = await fetch('/api/v1/parties')
    const json = await res.json()
    setRows(json.data ?? [])
  }

  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/v1/parties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type, phone }) })
    setName(''); setPhone('')
    load()
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Parties</h1>
      <form onSubmit={create} className="flex gap-2 mb-4">
        <input className="border rounded p-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="border rounded p-2" value={type} onChange={(e) => setType(e.target.value)}>
          <option>CUSTOMER</option><option>SUPPLIER</option><option>BOTH</option>
        </select>
        <input className="border rounded p-2" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Add</button>
      </form>
      <table className="w-full border-collapse">
        <thead><tr className="border-b"><th className="p-2 text-left">Name</th><th className="p-2">Type</th><th className="p-2">Phone</th></tr></thead>
        <tbody>
          {rows.map((r) => (<tr key={r.id} className="border-b"><td className="p-2">{r.name}</td><td className="p-2">{r.type}</td><td className="p-2">{r.phone}</td></tr>))}
        </tbody>
      </table>
    </main>
  )
}

