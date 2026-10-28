import { db } from '@/db/client'
import type { TenantTx } from '@/db/tenant'
import { auditLog } from '@/db/schema'

export interface AuditEntry {
  tenantId: string
  userId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  before?: unknown
  after?: unknown
  ip?: string | null
}

/**
 * Append-only audit trail. Pass the tenant transaction as `client` so the audit
 * row commits atomically with the mutation it describes.
 */
export async function writeAudit(entry: AuditEntry, client: typeof db | TenantTx = db) {
  const target = client as typeof db
  await target.insert(auditLog).values({
    tenantId: entry.tenantId,
    userId: entry.userId ?? null,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    before: (entry.before ?? null) as any,
    after: (entry.after ?? null) as any,
    ip: entry.ip ?? null,
  })
}
