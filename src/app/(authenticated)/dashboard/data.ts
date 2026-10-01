// Dashboard data loading.
//
// `@kpis` (the strip) and `page.tsx` (the attention list) are separate parallel
// routes rendered in the same pass, and both need the KPI snapshot. React's
// `cache()` dedupes in-flight work within a render, so the four aggregate
// queries run once instead of twice.
//
// The arguments are primitives on purpose: `cache()` compares them by identity,
// so passing a freshly built object every call would defeat it entirely.
import { cache } from 'react'
import { requireScope } from '@/db/scope'
import {
  getDashboardAgeing,
  getDashboardAttention,
  getDashboardKpis,
} from '@/db/repo/dashboard'
import type { AgeingSummary, AttentionItem, DashboardKpis } from '@/shared/types'

export interface DashboardData {
  kpis: DashboardKpis
  attention: AttentionItem[]
  ageing: AgeingSummary
}

/** Pull the period selection out of `searchParams`, tolerating repeats. */
export function periodParams(
  searchParams: Record<string, string | string[] | undefined>,
): { period: string; from: string; to: string } {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))
  return {
    period: one(searchParams.period),
    from: one(searchParams.from),
    to: one(searchParams.to),
  }
}

export const loadDashboard = cache(
  async (period: string, from: string, to: string): Promise<DashboardData> => {
    const scope = await requireScope()
    // Ageing is a separate query with its own window function, so it runs
    // alongside the aggregates rather than inside them.
    const [kpis, ageing] = await Promise.all([
      getDashboardKpis(scope, { period, from, to }),
      getDashboardAgeing(scope),
    ])
    const attention = await getDashboardAttention(scope, kpis)
    return { kpis, attention, ageing }
  },
)
