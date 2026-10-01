'use client'

// Revenue / expenses / net profit over time.
//
// The only client component in the KPI path, and only because Recharts needs the
// DOM. The aggregation is already done on the server — this receives a finished
// series of at most twelve points and queries nothing.
//
// Every figure is also rendered as a real table: a chart is invisible to a
// screen reader and unreadable when copied, so the numbers are always available
// as text.

import { useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMonthBucket } from '@/shared/periods'
import { formatLakhCrore, formatTakaFromMinor } from '@/shared/format'

export interface TrendPoint {
  bucket: string
  revenueMinor: number
  expensesMinor: number
  netProfitMinor: number
}

type Range = '6m' | '12m' | 'fy'

const RANGES: Array<{ key: Range; label: string }> = [
  { key: '6m', label: '6 months' },
  { key: '12m', label: '12 months' },
  { key: 'fy', label: 'This fiscal year' },
]

/** Short axis label: 'Mar 26'. */
function monthLabel(bucket: string): string {
  return formatMonthBucket(bucket)
}

/** Compact tick text. The exact value is always in the tooltip and the table. */
function axisTaka(minor: number): string {
  const major = Math.abs(minor) / 100
  if (major >= 1e7) return `${(major / 1e7).toFixed(1)}Cr`
  if (major >= 1e5) return `${(major / 1e5).toFixed(1)}L`
  if (major >= 1e3) return `${(major / 1e3).toFixed(0)}K`
  return formatLakhCrore(major, false)
}

export function TrendChart({
  points,
  fyStartBucket,
  fyLabel,
}: {
  points: TrendPoint[]
  /** First 'YYYY-MM' bucket of the fiscal year, for the FY range. */
  fyStartBucket?: string
  fyLabel: string
}) {
  const [range, setRange] = useState<Range>('12m')
  const [showTable, setShowTable] = useState(false)

  const data = useMemo(() => {
    if (points.length === 0) return []
    if (range === '6m') return points.slice(-6)
    if (range === 'fy' && fyStartBucket) {
      return points.filter((p) => p.bucket >= fyStartBucket)
    }
    return points
  }, [points, range, fyStartBucket])

  const totals = useMemo(
    () =>
      data.reduce(
        (acc, p) => ({
          revenue: acc.revenue + p.revenueMinor,
          expenses: acc.expenses + p.expensesMinor,
          net: acc.net + p.netProfitMinor,
        }),
        { revenue: 0, expenses: 0, net: 0 },
      ),
    [data],
  )

  if (points.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No posted activity in this window, so there is no trend to draw.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Trend range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={`rounded px-2 py-1 text-xs font-medium ${
                range === r.key
                  ? 'bg-primary text-primary-foreground'
                  : 'border text-muted-foreground hover:bg-accent'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {data.length} month{data.length === 1 ? '' : 's'} · net{' '}
          <span className="tabular-nums font-medium text-foreground">
            {formatTakaFromMinor(totals.net)}
          </span>
        </p>
      </div>

      {/* A fixed height keeps the grid from reflowing as the range changes. */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis
              dataKey="bucket"
              tickFormatter={monthLabel}
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis
              tickFormatter={axisTaka}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={52}
            />
            <Tooltip
              formatter={(value, name) => [formatTakaFromMinor(Number(value)), String(name)]}
              labelFormatter={(label) => monthLabel(String(label))}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="revenueMinor"
              name="Revenue"
              className="fill-chart-1"
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="expensesMinor"
              name="Expenses"
              className="fill-chart-3"
              radius={[2, 2, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="netProfitMinor"
              name="Net profit"
              strokeWidth={2}
              dot={false}
              className="stroke-chart-2"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>


      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          className="underline hover:text-foreground"
        >
          {showTable ? 'Hide table' : 'Show table'}
        </button>
        <span>Figures are the ledger, not the invoice register.</span>
      </div>

      {showTable && (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Monthly revenue, expenses and net profit in taka
            </caption>
            <thead className="bg-muted text-left">
              <tr>
                <th scope="col" className="px-3 py-2">Month</th>
                <th scope="col" className="px-3 py-2 text-right">Revenue</th>
                <th scope="col" className="px-3 py-2 text-right">Expenses</th>
                <th scope="col" className="px-3 py-2 text-right">Net profit</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.bucket} className="border-t">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {monthLabel(p.bucket)}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatTakaFromMinor(p.revenueMinor)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatTakaFromMinor(p.expensesMinor)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatTakaFromMinor(p.netProfitMinor)}
                  </td>
                </tr>
              ))}
              <tr className="border-t font-medium">
                <th scope="row" className="px-3 py-2 text-left">Total</th>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatTakaFromMinor(totals.revenue)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatTakaFromMinor(totals.expenses)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatTakaFromMinor(totals.net)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

