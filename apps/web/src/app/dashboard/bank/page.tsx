'use client'

import { useEffect, useState } from 'react'

export default function BankPage() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [txs, setTxs] = useState<any[]>([])
  const [name, setName] = useState('')

  async function load() {
    const a = await fetch('/api/v1/bank/accounts').then((r) => r.json())
    setAccounts(a.data ?? [])
    const t = await fetch('/api/v1/bank/transactions').then((r) => r.json())
    setTxs(t.data ?? [])
  }

  useEffect(() => { load() }, [])

  async function createAccount(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/v1/bank/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    setName('')
    load()
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Bank</h1>
      <form onSubmit={createAccount} className="flex gap-2 mb-4">
        <input className="border rounded p-2" placeholder="Bank account name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Add</button>
      </form>
      <h2 className="font-semibold mb-2">Accounts</h2>
      <ul className="mb-4">{accounts.map((a) => <li key={a.id}>{a.name} ({a.bankName ?? ''})</li>)}</ul>
      <h2 className="font-semibold mb-2">Transactions</h2>
      <table className="w-full border-collapse">
        <thead><tr className="border-b"><th className="p-2 text-left">Date</th><th className="p-2 text-left">Desc</th><th className="p-2 text-right">Amount</th><th className="p-2">Type</th></tr></thead>
        <tbody>
          {txs.map((t) => (
            <tr key={t.id} className="border-b"><td className="p-2">{new Date(t.date).toLocaleDateString()}</td><td className="p-2">{t.description}</td><td className="p-2 text-right">{t.amount}</td><td className="p-2">{t.type}</td></tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}

