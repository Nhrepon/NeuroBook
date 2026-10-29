import { db } from '@/lib/db/client'
import type { TenantTx } from '@/lib/db/tenant'
import { auditLog } from '@/lib/db/schema'
import { headers } from 'next/headers'

export interface AuditEntry {
  tenantId: string
  userId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  before?: unknown
  after?: unknown
  ip?: string | null
  /** Defaults to the `x-user-role` header the proxy set from the token. */
  actorRole?: string | null
  /** Defaults to the request's own user-agent / route. */
  userAgent?: string | null
  route?: string | null
}

/** Where a request came from: IP, browser / device, and which endpoint handled it. */
interface RequestMeta {
  ip: string | null
  actorRole: string | null
  userAgent: string | null
  route: string | null
}

/**
 * Reads the request context the proxy prepared. Callers do not pass any of this,
 * so every audited write records who did it, from where, and through which
 * endpoint without each route having to remember. Outside a request (a script)
 * the headers are unavailable and every field is null.
 */
async function requestMeta(): Promise<RequestMeta> {
  try {
    const h = await headers()
    const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim()
    return {
      ip: forwarded || h.get('x-real-ip') || null,
      actorRole: h.get('x-user-role'),
      userAgent: h.get('user-agent'),
      route: h.get('x-audit-route'),
    }
  } catch {
    return { ip: null, actorRole: null, userAgent: null, route: null }
  }
}

/**
 * Keys whose values must never be persisted in the audit trail, however they are
 * nested. `before` / `after` blobs are captured generically, so a password change
 * would otherwise write the hash (or worse, a plaintext field) into the log.
 */
const SENSITIVE_KEYS = new Set([
  'password', 'passwordhash', 'currentpassword', 'newpassword', 'confirmpassword',
  'oldpassword', 'totpsecret', 'secret', 'token', 'accesstoken', 'refreshtoken',
  'refreshtokenhash', 'apikey', 'privatekey',
])

/** Recursively replaces sensitive values with a marker before they are stored. */
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[redacted]' : redact(val)
    }
    return out
  }
  return value
}

/**
 * Append-only audit trail. Pass the tenant transaction as `client` so the audit
 * row commits atomically with the mutation it describes.
 */
export async function writeAudit(entry: AuditEntry, client: typeof db | TenantTx = db) {
  const meta = await requestMeta()
  const target = client as typeof db
  await target.insert(auditLog).values({
    tenantId: entry.tenantId,
    userId: entry.userId ?? null,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    before: redact(entry.before ?? null) as any,
    after: redact(entry.after ?? null) as any,
    ip: entry.ip ?? meta.ip,
    actorRole: entry.actorRole ?? meta.actorRole,
    userAgent: entry.userAgent ?? meta.userAgent,
    route: entry.route ?? meta.route,
  })
}
