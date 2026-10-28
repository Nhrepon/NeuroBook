import argon2 from 'argon2'
import { and, eq } from 'drizzle-orm'
import { db } from './client'
import { tenants, users, accounts } from './schema'

async function main() {
  let [tenant] = await db.select().from(tenants).where(eq(tenants.slug, 'demo'))
  if (!tenant) {
    ;[tenant] = await db.insert(tenants).values({ name: 'Demo Company', slug: 'demo' }).returning()
  }

  const hash = await argon2.hash('password123', { type: argon2.argon2id })
  const demoUsers = [
    { email: 'admin@demo.com', role: 'ADMIN' as const },
    { email: 'manager@demo.com', role: 'MANAGER' as const },
    { email: 'accountant@demo.com', role: 'ACCOUNTANT' as const },
    { email: 'sales@demo.com', role: 'SALES' as const },
    { email: 'purchaser@demo.com', role: 'PURCHASER' as const },
    { email: 'cashier@demo.com', role: 'CASHIER' as const },
    { email: 'store@demo.com', role: 'STORE_KEEPER' as const },
    { email: 'auditor@demo.com', role: 'AUDITOR' as const },
    { email: 'viewer@demo.com', role: 'VIEWER' as const },
  ]

  for (const u of demoUsers) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.email, u.email)))
    if (!existing) {
      await db.insert(users).values({ tenantId: tenant.id, email: u.email, passwordHash: hash, role: u.role })
    }
  }

  const [account] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.tenantId, tenant.id))
  if (!account) {
    await db.insert(accounts).values([
      { tenantId: tenant.id, name: 'Cash', code: '1100', type: 'ASSET' },
      { tenantId: tenant.id, name: 'Accounts Receivable', code: '1200', type: 'ASSET' },
      { tenantId: tenant.id, name: 'VAT Payable', code: '2100', type: 'LIABILITY' },
      { tenantId: tenant.id, name: 'Sales Revenue', code: '4000', type: 'REVENUE' },
      { tenantId: tenant.id, name: 'General Expense', code: '5000', type: 'EXPENSE' },
    ])
  }

  console.log('Seeded demo tenant (code: demo).')
  console.log('Password for all demo users: password123')
  console.log('  admin@demo.com      ADMIN')
  console.log('  manager@demo.com    MANAGER')
  console.log('  accountant@demo.com ACCOUNTANT')
  console.log('  sales@demo.com      SALES')
  console.log('  purchaser@demo.com  PURCHASER')
  console.log('  cashier@demo.com    CASHIER')
  console.log('  store@demo.com      STORE_KEEPER')
  console.log('  auditor@demo.com    AUDITOR')
  console.log('  viewer@demo.com     VIEWER')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
