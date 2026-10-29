import { NextRequest } from 'next/server'
import { createBankTransaction, getAllBankTransactions } from '@/controllers/bankTransactionController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return run(() => getAllBankTransactions(req.nextUrl.searchParams.get('bankAccountId')))
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => createBankTransaction(body), { status: 201 })
}