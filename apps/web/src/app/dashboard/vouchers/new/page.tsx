'use client'

import { useState } from 'react'

export default function NewVoucherPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [narration, setNarration] = useState('')
  const [type, setType] = useState('JOURNAL')
  const [a1, setA1] = useState('')
  const [d1, setD1] = useState('0')
  const [a2, setA2] = useState('')
  const [c2, setC2] = useState('0')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    const res = await fetch('/api/v1/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, narration, voucherType: type }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json?.error?.message ?? 'create failed'); return }
    const id = json.data.id
    const postRes = await fetch(`/api/v1/vouchers/${id}/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        narration,
        voucherType: type,
        entries: [
          { accountId: a1, accountType: 'ASSET', debit: Number(d1), credit: 0 },
          { accountId: a2, accountType: 'REVENUE', debit: 0, credit: Number(c2) },
        ],
      }),
    })
    const postJson = await postRes.json()
    if (!postRes.ok) { setError(postJson?.error?.message ?? 'post failed'); return }
    setResult(postJson.data.sequenceNumber)
  }

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <h1>New Voucher</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Narration <input value={narration} onChange={(e) => setNarration(e.target.value)} /></label>
        <label>Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {['PAYMENT','RECEIPT','JOURNAL','SALES_INVOICE','PURCHASE_INVOICE','DEBIT_NOTE','CREDIT_NOTE','CONTRA','REFUND','TRANSFER','STOCK_TRANSFER','ADJUSTMENT'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>Account 1 (debit) <input value={a1} onChange={(e) => setA1(e.target.value)} placeholder="uuid" /></label>
        <label>Debit <input value={d1} onChange={(e) => setD1(e.target.value)} /></label>
        <label>Account 2 (credit) <input value={a2} onChange={(e) => setA2(e.target.value)} placeholder="uuid" /></label>
        <label>Credit <input value={c2} onChange={(e) => setC2(e.target.value)} /></label>
        <button type="submit">Create & Post</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && <p style={{ color: 'green' }}>Posted: {result}</p>}
    </main>
  )
}

