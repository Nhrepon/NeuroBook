import { NextRequest } from 'next/server'
import { ok, created, err } from '@/lib/envelope'
import { listAccounts, createAccount } from '@/db/repo/accounts'
import { requireScope } from '@/db/scope'
import { AccountSchema } from '@neurobook/shared'

export async function GET() {
  const scope = await requireScope()
  return ok(await listAccounts(scope))
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = AccountSchema.safeParse(body)
  if (!parsed.success) {
    return err({ code: 'VALIDATION', message: 'Invalid input' }, 400)
  }
  const row = await createAccount(scope, parsed.data)
  return created(row)
}
