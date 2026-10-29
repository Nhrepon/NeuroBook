import { NextRequest } from 'next/server'
import { createTaxRate, deleteTaxRate, getAllTaxRates, updateTaxRate } from '@/controllers/taxRateController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(getAllTaxRates)
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => createTaxRate(body), { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await readBody(req)
  return run(() => updateTaxRate(body))
}

export async function DELETE(req: NextRequest) {
  return run(() => deleteTaxRate(req.nextUrl.searchParams.get('id') ?? ''))
}
