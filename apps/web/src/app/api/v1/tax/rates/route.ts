import { NextRequest } from 'next/server'
import { createTaxRate, getAllTaxRates } from '@/controllers/taxRateController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(getAllTaxRates)
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => createTaxRate(body), { status: 201 })
}