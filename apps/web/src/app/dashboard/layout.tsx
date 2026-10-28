import { headers } from 'next/headers'
import { normalizeRole } from '@neurobook/shared'
import Sidebar from '@/ui/Sidebar'
import TenantPanel from '@/ui/TenantPanel'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = normalizeRole((await headers()).get('x-user-role'))

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={role} />
      <main className="flex-1 overflow-y-auto p-4">
        <TenantPanel />
        {children}
      </main>
    </div>
  )
}
