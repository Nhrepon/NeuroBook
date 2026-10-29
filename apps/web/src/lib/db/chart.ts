import { eq } from 'drizzle-orm'
import { DEFAULT_CHART } from '@neurobook/shared'
import { db } from './client'
import { accounts } from './schema'
import type { TenantTx } from './tenant'

/**
 * Inserts any missing default ledgers for a tenant. Safe to run repeatedly:
 * existing codes are left untouched so tenant edits are never overwritten.
 */
export async function ensureDefaultChart(
  tenantId: string,
  client: typeof db | TenantTx = db,
): Promise<number> {
  const target = client as typeof db
  const existing = await target
    .select({ code: accounts.code })
    .from(accounts)
    .where(eq(accounts.tenantId, tenantId))

  const have = new Set(existing.map((a) => a.code))
  const missing = DEFAULT_CHART.filter((a) => !have.has(a.code))
  if (missing.length === 0) return 0

  await target.insert(accounts).values(
    missing.map((a) => ({
      tenantId,
      code: a.code,
      name: a.name,
      type: a.type,
      isGroup: a.isGroup ?? false,
      taxApplicable: a.taxApplicable ?? false,
    })),
  )

  return missing.length
}

export async function hasChart(tenantId: string, client: typeof db | TenantTx = db): Promise<boolean> {
  const target = client as typeof db
  const [row] = await target
    .select({ code: accounts.code })
    .from(accounts)
    .where(eq(accounts.tenantId, tenantId))
    .limit(1)
  return Boolean(row)
}