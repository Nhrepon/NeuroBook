// /api/v1/companies — tenant CRUD (super_admin only). Phase 1 stub.
import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { db } from '@/db/client'
import { tenants } from '@/db/schema/tenant'

export async function GET() {
  const scope = await requireScope()
  if (scope.role !== 'SUPER_ADMIN') {
    return err({ code: 'FORBIDDEN', message: 'Super admin only' }, 403)
  }
  return ok(await db.select().from(tenants))
}
