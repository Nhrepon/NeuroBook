'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function VoucherDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [data, setData] = useState<any>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    const res = await fetch(`/api/v1/vouchers/${id}`)
    const json = await res.json()
    setData(json.data)
  }

  useEffect(() => { if (id) load() }, [id])

  async function reverse() {
    const res = await fetch(`/api/v1/vouchers/${id}/reverse`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const json = await res.json()
    if (!res.ok) setMsg(json?.error?.message ?? 'reverse failed')
    else { setMsg('Reversed: ' + json.data.sequenceNumber); load() }
  }

  if (!data) return <main style={{ padding: 24 }}>Loading...</main>

  return (
    <main style={{ padding: 24 }}>
      <h1>Voucher {data.sequenceNumber ?? data.id}</h1>
      <p>{data.voucherType} — {data.status}</p>
      <p>{data.narration}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th>Account</th><th>Type</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>
          {data.lines?.map((l: any) => (
            <tr key={l.id}><td>{l.accountId}</td><td>{l.accountType}</td><td>{l.debit}</td><td>{l.credit}</td></tr>
          ))}
        </tbody>
      </table>
      {data.status === 'posted' && <button onClick={reverse} className="mt-3 mr-2 px-3 py-1 bg-red-600 text-white rounded">Reverse</button>}
      {data.status === 'draft' && <a href={`/vouchers/${id}/edit`} className="mt-3 inline-block px-3 py-1 bg-blue-600 text-white rounded">Edit</a>}
      {msg && <p>{msg}</p>}
    </main>
  )
}
