// R9/R10: tenant scope is resolved once per request from the verified JWT
// (set by middleware) and threaded through every query via this helper.
// The repository refuses to run a query without an explicit scope.
import { headers } from 'next/headers'

export interface RequestScope {
  tenantId: string
  userId: string
  role: string
}

/** Read the scope set by middleware. Throws if missing — every request through middleware has one. */
export async function requireScope(): Promise<RequestScope> {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  const userId = h.get('x-user-id')
  const role = h.get('x-user-role')
  if (!tenantId || !userId || !role) {
    throw new Error('No request scope; this code path should not be reachable.')
  }
  return { tenantId, userId, role }
}
