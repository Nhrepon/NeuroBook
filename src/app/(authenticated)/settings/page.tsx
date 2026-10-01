import type { Metadata } from 'next'
import { db } from '@/db/client'
import { tenants } from '@/db/schema/tenant'
import { eq } from 'drizzle-orm'
import { requireScope } from '@/db/scope'
import { formatDateBd, currentFiscalYear } from '@/shared/format'
import { TenantForm } from '@/ui/TenantForm'
import { UserList } from '@/ui/UserList'
import { PeriodList } from '@/ui/PeriodList'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const scope = await requireScope()
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, scope.tenantId))
  const fy = currentFiscalYear()

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section>
        <h2 className="text-lg font-semibold">Company</h2>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Fiscal year: {fy.label} ({formatDateBd(fy.start)} – {formatDateBd(fy.end)})
        </p>
        <TenantForm initial={tenant ?? null} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Users</h2>
        <UserList />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Fiscal periods</h2>
        <PeriodList />
      </section>
    </div>
  )
}
