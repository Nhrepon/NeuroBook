import { db } from '@/db/client'
import { users } from '@/db/schema/auth'
import { eq } from 'drizzle-orm'
import { requireScope } from '@/db/scope'
import { UserRows } from './UserRows'

export async function UserList() {
  const scope = await requireScope()
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      active: users.active,
      fullName: users.fullName,
      totpEnabled: users.totpEnabled,
    })
    .from(users)
    .where(eq(users.tenantId, scope.tenantId))
  return <UserRows users={rows} canManage={scope.role === 'ADMIN' || scope.role === 'SUPER_ADMIN'} />
}
