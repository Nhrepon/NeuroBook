import { NextRequest } from 'next/server'
import { createUser, deleteUser, getAllUsers, updateUser } from '@/controllers/userController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(getAllUsers)
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => createUser(body), { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await readBody(req)
  return run(() => updateUser(body))
}

export async function DELETE(req: NextRequest) {
  return run(() => deleteUser(req.nextUrl.searchParams.get('id') ?? ''))
}