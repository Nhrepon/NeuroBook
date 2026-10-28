import { requireScope } from '@/db/scope'
import { sessionProfile } from '@/lib/tenant-membership'

/**
 * The session's own profile: who is signed in and which company the request is
 * bound to. Read from the tenant in the token rather than the user's home row, so
 * an ADMIN visiting another company sees that company, not its own.
 */
export async function GET() {
  const scope = await requireScope()
  const me = await sessionProfile(scope)
  if (!me) return Response.json({ error: { code: 'NOT_FOUND', message: 'user not found' } }, { status: 404 })
  return Response.json({ data: me })
}
