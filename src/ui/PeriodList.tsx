import { db } from '@/db/client'
import { fiscalPeriods } from '@/db/schema/tenant'
import { eq } from 'drizzle-orm'
import { requireScope } from '@/db/scope'
import { PeriodRows } from './PeriodRows'

export async function PeriodList() {
  const scope = await requireScope()
  const rows = await db
    .select()
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.tenantId, scope.tenantId))
  return <PeriodRows periods={rows} isSuperAdmin={scope.role === 'SUPER_ADMIN'} />
}
