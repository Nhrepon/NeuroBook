'use client'

import { useEffect, useState } from 'react'

export default function ReportsPage() {
  const [type, setType] = useState('trial-balance')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/reports/${type}`).then((r) => r.json()).then((j) => { setData(j.data); setLoading(false) })
  }, [type])

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Reports</h1>
      <div className="flex gap-2 mb-4">
        {['trial-balance', 'profit-loss', 'balance-sheet'].map((t) => (
          <button key={t} onClick={() => setType(t)} className={`px-3 py-1 border rounded ${type === t ? 'bg-blue-600 text-white' : ''}`}>{t}</button>
        ))}
      </div>
      {loading && <p>Loading...</p>}
      {!loading && type === 'trial-balance' && (
        <table className="w-full border-collapse">
          <thead><tr className="border-b"><th className="text-left p-2">Code</th><th className="text-left p-2">Account</th><th className="text-right p-2">Debit</th><th className="text-right p-2">Credit</th></tr></thead>
          <tbody>
            {data?.rows?.map((r: any) => (
              <tr key={r.accountId} className="border-b"><td className="p-2">{r.code}</td><td className="p-2">{r.accountName}</td><td className="p-2 text-right">{r.debit}</td><td className="p-2 text-right">{r.credit}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={2} className="p-2 font-bold">Total</td><td className="p-2 text-right font-bold">{data?.totals?.debit}</td><td className="p-2 text-right font-bold">{data?.totals?.credit}</td></tr></tfoot>
        </table>
      )}
      {!loading && type === 'profit-loss' && (
        <div className="space-y-2">
          <p>Revenue: {data?.revenue}</p>
          <p>Expenses: {data?.expenses}</p>
          <p className="font-bold">Net: {data?.net}</p>
        </div>
      )}
      {!loading && type === 'balance-sheet' && (
        <div className="space-y-2">
          <p>Assets: {data?.assets}</p>
          <p>Liabilities: {data?.liabilities}</p>
          <p>Equity: {data?.equity}</p>
        </div>
      )}
    </main>
  )
}
