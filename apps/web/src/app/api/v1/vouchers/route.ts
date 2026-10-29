import { NextRequest } from 'next/server'
import { createVoucher, getAllVouchers } from '@/controllers/voucherController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return run(() => getAllVouchers(req.nextUrl.searchParams.get('type')))
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => createVoucher(body), { status: 201 })
}
