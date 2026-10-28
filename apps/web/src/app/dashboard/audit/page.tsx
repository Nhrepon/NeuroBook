'use client'

import { useEffect, useState } from 'react'

export default function AuditPage() {
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/v1/audit').then((r) => r.json()).then((j) => setRows(j.data ?? []))
  }, [])

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Audit Log</h1>
      <table className="w-full border-collapse">
        <thead><tr className="border-b"><th className="p-2 text-left">Time</th><th className="p-2 text-left">Action</th><th className="p-2 text-left">Resource</th><th className="p-2 text-left">User</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
              <td className="p-2">{r.action}</td>
              <td className="p-2">{r.resourceType}:{r.resourceId}</td>
              <td className="p-2">{r.userId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}

