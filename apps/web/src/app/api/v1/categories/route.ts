import { NextRequest } from 'next/server'
import { createCategory, deleteCategory, getAllCategories, updateCategory } from '@/controllers/categoryController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(getAllCategories)
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => createCategory(body), { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await readBody(req)
  return run(() => updateCategory(body))
}

export async function DELETE(req: NextRequest) {
  return run(() => deleteCategory(req.nextUrl.searchParams.get('id') ?? ''))
}