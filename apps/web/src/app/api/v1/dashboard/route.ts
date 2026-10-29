import { getDashboardSummary } from '@/controllers/dashboardController'
import { run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(getDashboardSummary)
}