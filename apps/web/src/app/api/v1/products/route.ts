import { NextRequest } from 'next/server'
import { createProducts, deleteProduct, getAllProducts, updateProduct } from '@/controllers/productController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(getAllProducts)
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => createProducts(body), { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await readBody(req)
  return run(() => updateProduct(body))
}

export async function DELETE(req: NextRequest) {
  return run(() => deleteProduct(req.nextUrl.searchParams.get('id') ?? ''))
}