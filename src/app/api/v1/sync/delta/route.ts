import { NextRequest } from 'next/server'
import { ok } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { db } from '@/db/client'
import { vouchers, accounts } from '@/db/schema/accounting'
import { and, eq, gt, desc } from 'drizzle-orm'

// GET /api/v1/sync/delta?since=<isoTimestamp>&limit=200
// Incremental pull — the mobile client uses this to refresh its read cache.
export async function GET(req: NextRequest) {
  const scope = await requireScope()
  const since = req.nextUrl.searchParams.get('since')
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 200), 500)

  const v = await db
    .select()
    .from(vouchers)
    .where(
      and(
        eq(vouchers.tenantId, scope.tenantId),
        since ? gt(vouchers.updatedAt, new Date(since)) : undefined,
      ),
    )
    .orderBy(desc(vouchers.updatedAt))
    .limit(limit)

  const a = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, scope.tenantId),
        since ? gt(accounts.createdAt, new Date(since)) : undefined,
      ),
    )
    .orderBy(desc(accounts.createdAt))
    .limit(limit)

  return ok({ vouchers: v, accounts: a })
}
