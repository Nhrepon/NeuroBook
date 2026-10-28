'use client'

import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState('')
  const [binNumber, setBinNumber] = useState('')
  const [tinNumber, setTinNumber] = useState('')
  const [currency, setCurrency] = useState('BDT')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/v1/settings').then((r) => r.json()).then((j) => {
      if (j.data) {
        setCompanyName(j.data.companyName ?? '')
        setBinNumber(j.data.binNumber ?? '')
        setTinNumber(j.data.tinNumber ?? '')
        setCurrency(j.data.currency ?? 'BDT')
      }
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/v1/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, binNumber, tinNumber, currency }),
    })
    const json = await res.json()
    setMsg(res.ok ? 'Saved' : (json?.error?.message ?? 'error'))
  }

  return (
    <main className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <form onSubmit={save} className="space-y-3">
        <input className="w-full border rounded p-2" placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="BIN number" value={binNumber} onChange={(e) => setBinNumber(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="TIN number" value={tinNumber} onChange={(e) => setTinNumber(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </form>
      {msg && <p className="mt-2">{msg}</p>}
    </main>
  )
}
