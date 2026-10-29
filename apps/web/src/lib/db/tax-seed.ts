import { eq } from 'drizzle-orm'
import { db } from './client'
import { taxRates } from './schema'
import type { TenantTx } from './tenant'

/**
 * Rates a Bangladeshi company expects to see when it starts raising invoices.
 * Rates are in basis points (1500 = 15.00%). Companies edit or remove these —
 * nothing here is required.
 */
export const DEFAULT_TAX_RATES = [
  { name: 'VAT 15%', rate: 1500, kind: 'vat' },
  { name: 'VAT 7.5%', rate: 750, kind: 'vat' },
  { name: 'VAT 5%', rate: 500, kind: 'vat' },
  { name: 'VAT 0% (exempt)', rate: 0, kind: 'vat' },
  { name: 'AIT 5%', rate: 500, kind: 'ait' },
  { name: 'VDS 5%', rate: 500, kind: 'vds' },
] as const

/**
 * Inserts any missing default tax rates for a tenant. Safe to run repeatedly:
 * a rate of the same name is left as the company set it.
 */
export async function ensureDefaultTaxRates(
  tenantId: string,
  client: typeof db | TenantTx = db,
): Promise<number> {
  const target = client as typeof db
  const existing = await target
    .select({ name: taxRates.name })
    .from(taxRates)
    .where(eq(taxRates.tenantId, tenantId))

  const have = new Set(existing.map((r) => r.name))
  const missing = DEFAULT_TAX_RATES.filter((r) => !have.has(r.name))
  if (missing.length === 0) return 0

  await target.insert(taxRates).values(
    missing.map((r) => ({ tenantId, name: r.name, rate: r.rate, kind: r.kind })),
  )
  return missing.length
}
