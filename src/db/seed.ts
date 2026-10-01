// CLI: seed dev data. Creates a demo tenant with the BD chart-of-accounts
// template (U2 — must include the Rounding Difference account that R7
// depends on), an admin user, and a couple of sample vouchers.
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { tenants, accounts, users, fiscalPeriods } from './schema/index'
import { hashPassword } from './repo/auth'
import { eq } from 'drizzle-orm'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const client = postgres(url, { max: 1 })
  const db = drizzle(client)

  // 1. Tenant
  const [tenant] = await db.insert(tenants).values({
    name: 'Demo Co.',
    bin: '12345678901',
    tin: '1234567890',
    address: 'Banani, Dhaka',
    division: 'Dhaka',
    district: 'Dhaka',
  }).returning()

  // 2. Fiscal period (NBR FY 1 Jul – 30 Jun, U3)
  await db.insert(fiscalPeriods).values({
    tenantId: tenant!.id,
    label: 'FY 2025-26',
    startDate: new Date('2025-07-01T00:00:00Z'),
    endDate: new Date('2026-06-30T23:59:59Z'),
  })

  // 3. BD chart-of-accounts template (R7 needs a Rounding Difference account).
  const bdChart: Array<{ name: string; code: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' }> = [
    { code: '1000', name: 'Current Assets', type: 'ASSET', isGroup: true } as any,
    { code: '1100', name: 'Cash in Hand', type: 'ASSET' },
    { code: '1200', name: 'Cash at Bank', type: 'ASSET' },
    { code: '1300', name: 'Sundry Debtors', type: 'ASSET' },
    { code: '1400', name: 'Inventory', type: 'ASSET' },
    { code: '2000', name: 'Current Liabilities', type: 'LIABILITY', isGroup: true } as any,
    { code: '2100', name: 'Sundry Creditors', type: 'LIABILITY' },
    { code: '2200', name: 'VAT Payable', type: 'LIABILITY' },
    { code: '2300', name: 'TDS Payable', type: 'LIABILITY' },
    { code: '3000', name: 'Capital', type: 'EQUITY' },
    { code: '3900', name: 'Retained Earnings', type: 'EQUITY' },
    { code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
    { code: '6000', name: 'Operating Expenses', type: 'EXPENSE', isGroup: true } as any,
    { code: '6100', name: 'Rent Expense', type: 'EXPENSE' },
    { code: '6200', name: 'Salary Expense', type: 'EXPENSE' },
    { code: '9999', name: 'Rounding Difference', type: 'EXPENSE' },  // R7
  ]
  await db.insert(accounts).values(
    bdChart.map((a) => ({ ...a, tenantId: tenant!.id, isGroup: (a as any).isGroup ?? false })),
  )

  // 4. Admin user
  await db.insert(users).values({
    tenantId: tenant!.id,
    email: 'admin@demo.local',
    passwordHash: await hashPassword('changeme123'),
    role: 'ADMIN',
    fullName: 'Demo Admin',
    totpEnabled: false,
  })

  await client.end()
  console.log('Seed complete. Login: admin@demo.local / changeme123')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
