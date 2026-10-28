import { headers } from 'next/headers'
import { can, type Permission } from '@neurobook/shared'

export interface RequestScope { tenantId: string; userId: string; role: string }

export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export async function requireScope(): Promise<RequestScope> {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  const userId = h.get('x-user-id')
  const role = h.get('x-user-role')
  if (!tenantId || !userId || !role) throw new Error('No request scope')
  return { tenantId, userId, role }
}

/**
 * Defence in depth: the proxy already blocks unauthorized requests, but every
 * sensitive handler re-checks so a matcher gap cannot become a bypass.
 */
export async function requirePermission(permission: Permission): Promise<RequestScope> {
  const scope = await requireScope()
  if (!can(scope.role, permission)) throw new ForbiddenError()
  return scope
}

export function forbiddenResponse() {
  return Response.json(
    { error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action' } },
    { status: 403 },
  )
}
