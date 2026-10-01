import type { Metadata } from 'next'
import { listAccounts } from '@/db/repo/accounts'
import { requireScope } from '@/db/scope'

export const metadata: Metadata = { title: 'Chart of Accounts' }

export default async function AccountsPage() {
  const scope = await requireScope()
  const rows = await listAccounts(scope)
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Chart of Accounts</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Code</th>
            <th className="py-2">Name</th>
            <th className="py-2">Type</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b">
              <td className="py-2 font-mono">{a.code}</td>
              <td className="py-2">{a.name}</td>
              <td className="py-2">{a.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
