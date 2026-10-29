import { can } from '@neurobook/shared'
import { requireScope } from '@/controllers/scope'
import { listSwitchableCompanies, sessionProfile } from '@/lib/db/tenant-membership'
import CreateCompany from './CreateCompany'
import TenantBadge from './TenantBadge'
import TenantSwitcher from './TenantSwitcher'

/**
 * Server-rendered tenant strip at the top of the dashboard shell: which company
 * the session is bound to, plus the switch control for roles that may use it.
 * Resolving it on the server keeps the company visible on the first paint.
 *
 * The switcher lists the companies this email belongs to, and a create button
 * adds new ones.
 */
export default async function TenantPanel() {
  const scope = await requireScope()
  const me = await sessionProfile(scope)
  if (!me) return null

  const canSwitch = can(scope.role, 'tenant:switch')
  const canManageTenants = can(scope.role, 'tenant:manage')
  const companies = canSwitch ? await listSwitchableCompanies(scope, me.email) : []

  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
      <TenantBadge
        me={{ email: me.email, role: me.role, tenantName: me.tenantName, tenantSlug: me.tenantSlug }}
      />
      {companies.length > 1 && <TenantSwitcher companies={companies} />}
      {canManageTenants && <CreateCompany />}
    </div>
  )
}
