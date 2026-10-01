import { NextRequest } from 'next/server'
import { ok } from '@/lib/envelope'
import { revokeSession } from '@/db/repo/auth'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  const [sessionId] = token.split('.')
  const tenantHeader = req.headers.get('x-tenant-id') ?? ''
  if (sessionId && tenantHeader) {
    await revokeSession(sessionId, tenantHeader)
  }
  return ok({ revoked: true })
}
