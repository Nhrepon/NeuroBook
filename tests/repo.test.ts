// Repository golden test: posts a real voucher, asserts the rows on disk,
// and reproduces the header-vs-lines case the original trigger could not see.
// Requires a running Postgres with the 0001 migration applied and
// `neurobook.tenant_id` set via the SET command below.
import { describe, it, expect, beforeAll } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { postVoucher } from '../src/db/repo/post'
import { db } from '../src/db/client'
import { tenants, accounts, fiscalPeriods, users, sessions, vouchers, journalLines } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../src/db/repo/auth'

describe.skip('repo (requires Postgres + migrations)', () => {
  let tenantId = ''
  let cash = ''
  let revenue = ''
  let adminId = ''

  beforeAll(async () => {
    // The test fixture is wired to a non-superuser role; SET ROLE ensures
    // we exercise RLS, not bypass it.
    const client = postgres(process.env.DATABASE_URL!, { max: 1 })
    await client`SET ROLE neurobook_app`
    const conn = drizzle(client)

    const [t] = await conn.insert(tenants).values({ name: 'test' }).returning()
    tenantId = t!.id
    await conn.execute({ sql: `SELECT set_config('neurobook.tenant_id', '${tenantId}', false)` } as never)

    await conn.insert(fiscalPeriods).values({
      tenantId,
      label: 'FY 2025-26',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2026-06-30'),
    })

    const [c] = await conn.insert(accounts).values({
      tenantId, name: 'Cash', code: '1100', type: 'ASSET',
    }).returning()
    cash = c!.id
    const [r] = await conn.insert(accounts).values({
      tenantId, name: 'Revenue', code: '4000', type: 'REVENUE',
    }).returning()
    revenue = r!.id

    const [u] = await conn.insert(users).values({
      tenantId,
      email: 'test@local',
      passwordHash: await hashPassword('testtest'),
      role: 'ADMIN',
    }).returning()
    adminId = u!.id

    await conn.insert(sessions).values({
      tenantId, userId: adminId, refreshTokenHash: 'x', expiresAt: new Date(Date.now() + 86400_000),
    })

    await client.end()
  })

  it('posts a balanced voucher and writes the lines', async () => {
    const [draft] = await db.insert(vouchers).values({
      tenantId, voucherType: 'JOURNAL', date: new Date('2025-09-15'),
      narration: 'test', createdBy: adminId,
    }).returning()

    const result = await postVoucher({
      tenantId, userId: adminId, voucherId: draft!.id,
      date: '2025-09-15', narration: 'test', voucherType: 'JOURNAL',
      entries: [
        { accountId: cash, accountType: 'ASSET', debit: 10_000, credit: 0 },
        { accountId: revenue, accountType: 'REVENUE', debit: 0, credit: 10_000 },
      ],
    })

    expect(result.sequenceNumber).toMatch(/JOURNAL\/FY 2025-26\/\d{6}/)

    const lines = await db.select().from(journalLines).where(eq(journalLines.voucherId, draft!.id))
    expect(lines).toHaveLength(2)
    expect(lines[0]!.debit).toBe(10_000)
    expect(lines[1]!.credit).toBe(10_000)
  })

  it('rejects an unbalanced voucher with the R4 trigger', async () => {
    const [draft] = await db.insert(vouchers).values({
      tenantId, voucherType: 'JOURNAL', date: new Date('2025-09-15'),
      narration: 'bad', createdBy: adminId,
    }).returning()
    await expect(
      postVoucher({
        tenantId, userId: adminId, voucherId: draft!.id,
        date: '2025-09-15', narration: 'bad', voucherType: 'JOURNAL',
        entries: [
          { accountId: cash, accountType: 'ASSET', debit: 100, credit: 0 },
          { accountId: revenue, accountType: 'REVENUE', debit: 0, credit: 99 },
        ],
      }),
    ).rejects.toThrow(/UNBALANCED/)
  })
})
