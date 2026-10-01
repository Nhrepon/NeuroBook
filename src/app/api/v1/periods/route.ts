import { ok } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { listPeriods } from '@/db/repo/fiscalPeriods'

// GET /api/v1/periods
export async function GET() {
  const scope = await requireScope()
  return ok(await listPeriods(scope))
}
