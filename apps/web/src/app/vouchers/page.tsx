'use client'

import { useEffect, useState } from 'react'

export default function VouchersPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/vouchers').then((r) => r.json()).then((j) => { setRows(j.data ?? []); setLoading(false) })
  }, [])

  if (loading) return <main style={{ padding: 24 }}>Loading...</main>

  return (
    <main style={{ padding: 24 }}>
      <h1>Vouchers</h1>
      <p><a href="/vouchers/new">+ New voucher</a></p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th>Date</th><th>Type</th><th>Narration</th><th>Status</th><th>Seq</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><a href={`/vouchers/${r.id}`}>{new Date(r.date).toLocaleDateString()}</a></td>
              <td>{r.voucherType}</td>
              <td>{r.narration}</td>
              <td>{r.status}</td>
              <td>{r.sequenceNumber ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
