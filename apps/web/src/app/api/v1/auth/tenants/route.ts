import { can } from '@neurobook/shared'
import { forbiddenResponse, requireScope } from '@/db/scope'
import { listSwitchableCompanies, sessionProfile } from '@/lib/tenant-membership'

/**
 * Companies the switch dialog may offer. Only roles that may actually switch
 * (ADMIN, MANAGER) can read the list. For an ADMIN it also includes every other
 * company on the server, which it may enter with that company's password.
 */
export async function GET() {
  const scope = await requireScope()
  if (!can(scope.role, 'tenant:switch')) return forbiddenResponse()

  const me = await sessionProfile(scope)
  if (!me) return Response.json({ error: { code: 'NOT_FOUND', message: 'user not found' } }, { status: 404 })

  return Response.json({ data: await listSwitchableCompanies(scope, me.email) })
}
