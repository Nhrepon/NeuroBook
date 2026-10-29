import { NextRequest } from 'next/server'
import { createProductSkus, deleteProductSku, getAllProductSkus } from '@/controllers/productSkuController'
import { readBody, run, runEnvelope } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return run(() => getAllProductSkus(req.nextUrl.searchParams.get('productId')))
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return runEnvelope(() => createProductSkus(body), { status: 201 })
}

export async function DELETE(req: NextRequest) {
  return run(() => deleteProductSku(req.nextUrl.searchParams.get('id') ?? ''))
}