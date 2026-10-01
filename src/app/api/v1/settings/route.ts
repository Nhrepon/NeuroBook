// Company settings — read/update the tenant profile.
import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { db } from '@/db/client'
import { tenants } from '@/db/schema/tenant'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const PatchTenant = z.object({
  name: z.string().min(1).optional(),
  bin: z.string().optional(),
  tin: z.string().optional(),
  address: z.string().optional(),
  division: z.string().optional(),
  district: z.string().optional(),
  upazila: z.string().optional(),
  union: z.string().optional(),
})

export async function GET() {
  const scope = await requireScope()
  const [row] = await db.select().from(tenants).where(eq(tenants.id, scope.tenantId))
  if (!row) return err({ code: 'NOT_FOUND', message: 'Tenant not found' }, 404)
  return ok(row)
}

export async function PATCH(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = PatchTenant.safeParse(body)
  if (!parsed.success) {
    return err({ code: 'VALIDATION', message: 'Invalid input' }, 400)
  }
  const [row] = await db
    .update(tenants)
    .set(parsed.data)
    .where(eq(tenants.id, scope.tenantId))
    .returning()
  return ok(row)
}
