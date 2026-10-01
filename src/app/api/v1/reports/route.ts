// Reports index — lists available report types.
import { ok } from '@/lib/envelope'

export async function GET() {
  return ok({
    reports: [
      { type: 'trial-balance', label: 'Trial Balance' },
      { type: 'profit-loss', label: 'Profit & Loss' },
      { type: 'balance-sheet', label: 'Balance Sheet' },
    ],
  })
}
