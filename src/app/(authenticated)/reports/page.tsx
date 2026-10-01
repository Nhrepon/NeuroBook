import type { Metadata } from 'next'
import { listVouchers } from '@/db/repo/vouchers'
import { requireScope } from '@/db/scope'
import { trialBalance, profitAndLoss, balanceSheet } from '@neurobook/shared/ledger'
import { formatTakaFromMinor } from '@neurobook/shared/format'

export const metadata: Metadata = { title: 'Reports' }

export default async function ReportsIndexPage() {
  const scope = await requireScope()
  const { items: posted } = await listVouchers(scope, { status: 'posted', limit: 200 })
  const tb = trialBalance(posted as never)
  const pnl = profitAndLoss(posted as never)
  const bs = balanceSheet(posted as never)

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Reports</h1>

      <section>
        <h2 className="text-lg font-semibold">Trial Balance</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Account</th>
              <th className="py-2 text-right">Debit</th>
              <th className="py-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {tb.map((b) => (
              <tr key={b.account.id} className="border-b">
                <td className="py-2">{b.account.code} — {b.account.name}</td>
                <td className="py-2 text-right">{formatTakaFromMinor(b.debit)}</td>
                <td className="py-2 text-right">{formatTakaFromMinor(b.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Profit &amp; Loss</h2>
        <p className="text-sm">Net profit: {formatTakaFromMinor(pnl.netProfit)}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Balance Sheet</h2>
        <p className="text-sm">
          Assets: {formatTakaFromMinor(bs.totalsAssets)} ·
          L+E: {formatTakaFromMinor(bs.totalsLiabilitiesAndEquity)}
        </p>
      </section>
    </div>
  )
}
