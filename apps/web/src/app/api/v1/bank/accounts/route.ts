import { NextRequest } from 'next/server'
import { createBankAccount, getAllBankAccounts } from '@/controllers/bankAccountController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(getAllBankAccounts)
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => createBankAccount(body), { status: 201 })
}