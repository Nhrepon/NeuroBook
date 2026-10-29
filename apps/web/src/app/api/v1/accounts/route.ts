import { NextRequest } from 'next/server'
import { createAccount, getAllAccounts } from '@/controllers/accountController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(getAllAccounts)
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => createAccount(body), { status: 201 })
}