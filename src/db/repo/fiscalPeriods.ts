// R2: period locking. A closed fiscal period refuses posts; only
// SUPER_ADMIN may reopen, and the reopen is itself audit-logged.
import { db } from '../client'
import { fiscalPeriods } from '../schema/tenant'
import { and, eq, asc } from 'drizzle-orm'
import type { RequestScope } from '../scope'
import { currentFiscalYear } from '@/shared/format'

export async function listPeriods(scope: RequestScope) {
  return db
    .select()
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.tenantId, scope.tenantId))
    .orderBy(asc(fiscalPeriods.startDate))
}

export function periodLabelForDate(isoDate: string): string {
  const fy = currentFiscalYear(new Date(isoDate))
  return fy.label
}

export async function closePeriod(scope: RequestScope, label: string) {
  if (scope.role !== 'SUPER_ADMIN' && scope.role !== 'ADMIN') {
    throw new Error('PERIOD_LOCKED: only an admin may close a period.')
  }
  const [row] = await db
    .update(fiscalPeriods)
    .set({ status: 'closed', closedBy: scope.userId, closedAt: new Date() })
    .where(and(eq(fiscalPeriods.tenantId, scope.tenantId), eq(fiscalPeriods.label, label)))
    .returning()
  if (!row) throw new Error(`No such fiscal period: ${label}`)
  return row
}

export async function reopenPeriod(scope: RequestScope, label: string) {
  if (scope.role !== 'SUPER_ADMIN') {
    throw new Error('PERIOD_LOCKED: only a SUPER_ADMIN may reopen a closed period. This will be audit-logged.')
  }
  const [row] = await db
    .update(fiscalPeriods)
    .set({ status: 'open', reopenedBy: scope.userId, reopenedAt: new Date() })
    .where(and(eq(fiscalPeriods.tenantId, scope.tenantId), eq(fiscalPeriods.label, label)))
    .returning()
  if (!row) throw new Error(`No such fiscal period: ${label}`)
  return row
}

export async function isPeriodClosed(scope: RequestScope, isoDate: string): Promise<boolean> {
  const label = periodLabelForDate(isoDate)
  const [period] = await db
    .select()
    .from(fiscalPeriods)
    .where(and(eq(fiscalPeriods.tenantId, scope.tenantId), eq(fiscalPeriods.label, label)))
  return period?.status === 'closed'
}
