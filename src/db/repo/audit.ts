// R15: append-only audit log. Never updated, never deleted.
import { db } from '../client'
import { auditLog } from '../schema/index'
import type { RequestScope } from '../scope'

export interface AuditEntry {
  action: string             // e.g. "voucher.post"
  resourceType: string
  resourceId?: string
  before?: unknown
  after?: unknown
  ip?: string
}

export async function audit(scope: Pick<RequestScope, 'tenantId' | 'userId'>, entry: AuditEntry) {
  await db.insert(auditLog).values({
    tenantId: scope.tenantId,
    userId: scope.userId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    before: entry.before as object | undefined,
    after: entry.after as object | undefined,
    ip: entry.ip,
  })
}
