'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function EditVoucherPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const [date, setDate] = useState('')
  const [narration, setNarration] = useState('')
  const [a1, setA1] = useState('')
  const [d1, setD1] = useState('0')
  const [a2, setA2] = useState('')
  const [c2, setC2] = useState('0')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/v1/vouchers/${id}`).then((r) => r.json()).then((j) => {
      if (j.data) {
        setDate(new Date(j.data.date).toISOString().slice(0, 10))
        setNarration(j.data.narration ?? '')
        const lines = j.data.lines ?? []
        if (lines[0]) { setA1(lines[0].accountId); setD1(String(lines[0].debit)) }
        if (lines[1]) { setA2(lines[1].accountId); setC2(String(lines[1].credit)) }
      }
    })
  }, [id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`/api/v1/vouchers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        narration,
        entries: [
          { accountId: a1, accountType: 'ASSET', debit: Number(d1), credit: 0 },
          { accountId: a2, accountType: 'REVENUE', debit: 0, credit: Number(c2) },
        ],
      }),
    })
    const json = await res.json()
    if (!res.ok) setMsg(json?.error?.message ?? 'update failed')
    else router.push(`/vouchers/${id}`)
  }

  return (
    <main className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Edit Voucher</h1>
      <form onSubmit={submit} className="space-y-3">
        <input type="date" className="w-full border rounded p-2" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="w-full border rounded p-2" value={narration} onChange={(e) => setNarration(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="Account 1 UUID" value={a1} onChange={(e) => setA1(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="Debit" value={d1} onChange={(e) => setD1(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="Account 2 UUID" value={a2} onChange={(e) => setA2(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="Credit" value={c2} onChange={(e) => setC2(e.target.value)} />
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </form>
      {msg && <p className="mt-2 text-red-600">{msg}</p>}
    </main>
  )
}
