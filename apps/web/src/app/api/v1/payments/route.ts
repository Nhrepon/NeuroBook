import { NextRequest } from 'next/server'
import { getAllPayments, recordPayment } from '@/controllers/paymentController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return run(() => getAllPayments(req.nextUrl.searchParams.get('invoiceId')))
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => recordPayment(body), { status: 201 })
}
