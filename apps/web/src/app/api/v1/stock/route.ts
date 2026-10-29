import { NextRequest } from 'next/server'
import { adjustStock, getStockLevels } from '@/controllers/stockController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(getStockLevels)
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => adjustStock(body), { status: 201 })
}