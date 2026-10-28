import { headers } from 'next/headers'

export interface RequestScope { tenantId: string; userId: string; role: string }

export async function requireScope(): Promise<RequestScope> {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  const userId = h.get('x-user-id')
  const role = h.get('x-user-role')
  if (!tenantId || !userId || !role) throw new Error('No request scope')
  return { tenantId, userId, role }
}
