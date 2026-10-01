import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { db } from '@/db/client'
import { products } from '@/db/schema/parties'
import { eq } from 'drizzle-orm'

export async function GET() {
  const scope = await requireScope()
  const rows = await db.select().from(products).where(eq(products.tenantId, scope.tenantId))
  return ok(rows)
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  if (!body?.name) {
    return err({ code: 'VALIDATION', message: 'name required' }, 400)
  }
  const [row] = await db
    .insert(products)
    .values({ ...body, tenantId: scope.tenantId })
    .returning()
  return ok(row)
}
