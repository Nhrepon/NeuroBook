'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { db } from '@/db/client'
import { tenants, users, fiscalPeriods, accounts } from '@/db/schema'
import { hashPassword } from '@/db/repo/auth'
import { SignJWT } from 'jose'
import { getJwtKeys } from '@/lib/jwt-keys'
import { ulidLike } from '@neurobook/shared'

// U2: BD chart-of-accounts template — MUST include the Rounding Difference
// account that R7 depends on. This is the same list the seed script uses.
const BD_CHART = [
  { code: '1000', name: 'Current Assets', type: 'ASSET', isGroup: true },
  { code: '1100', name: 'Cash in Hand', type: 'ASSET' },
  { code: '1200', name: 'Cash at Bank', type: 'ASSET' },
  { code: '1300', name: 'Sundry Debtors', type: 'ASSET' },
  { code: '1400', name: 'Inventory', type: 'ASSET' },
  { code: '2000', name: 'Current Liabilities', type: 'LIABILITY', isGroup: true },
  { code: '2100', name: 'Sundry Creditors', type: 'LIABILITY' },
  { code: '2200', name: 'VAT Payable', type: 'LIABILITY' },
  { code: '2300', name: 'TDS Payable', type: 'LIABILITY' },
  { code: '3000', name: 'Capital', type: 'EQUITY' },
  { code: '3900', name: 'Retained Earnings', type: 'EQUITY' },
  { code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
  { code: '6000', name: 'Operating Expenses', type: 'EXPENSE', isGroup: true },
  { code: '6100', name: 'Rent Expense', type: 'EXPENSE' },
  { code: '6200', name: 'Salary Expense', type: 'EXPENSE' },
  { code: '9999', name: 'Rounding Difference', type: 'EXPENSE' },
] as const

const RegisterInput = z.object({
  companyName: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  bin: z.string().max(32).optional(),
  tin: z.string().max(32).optional(),
})

export interface RegisterState {
  ok: boolean
  error: string | null
}

export async function registerTenantAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = RegisterInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, error: 'Please check the form fields.' }
  }
  const input = parsed.data

  // 1. Tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: input.companyName,
      bin: input.bin,
      tin: input.tin,
    })
    .returning()
  const tenantId = tenant!.id

  // 2. Fiscal period (NBR FY 1 Jul – 30 Jun)
  const y = new Date().getUTCFullYear()
  const m = new Date().getUTCMonth()
  const startYear = m >= 6 ? y : y - 1
  await db.insert(fiscalPeriods).values({
    tenantId,
    label: `FY ${startYear}-${String(startYear + 1).slice(-2)}`,
    startDate: new Date(Date.UTC(startYear, 6, 1)),
    endDate: new Date(Date.UTC(startYear + 1, 5, 30, 23, 59, 59)),
  })

  // 3. Chart of accounts (U2)
  await db.insert(accounts).values(
    BD_CHART.map((a) => ({
      tenantId,
      code: a.code,
      name: a.name,
      type: a.type as never,
      isGroup: 'isGroup' in a ? a.isGroup : false,
    })),
  )

  // 4. Admin user
  const [user] = await db.insert(users).values({
    tenantId,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role: 'ADMIN',
    fullName: input.companyName,
  }).returning()

  // 5. Issue access token + set cookie
  const keys = await getJwtKeys()
  const accessToken = await new SignJWT({ tid: tenantId, role: 'ADMIN' })
    .setProtectedHeader({ alg: "RS256", kid: keys.kid })
    .setSubject(user!.id)
    .setIssuer(process.env.JWT_ISSUER!)
    .setAudience(process.env.JWT_AUDIENCE!)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(keys.privateKey)

  const cookieJar = await cookies()
  cookieJar.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 900,
  })
  void ulidLike()   // import smoke
  redirect('/dashboard')
}
