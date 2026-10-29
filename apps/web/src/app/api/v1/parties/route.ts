import { NextRequest } from 'next/server'
import { createParty, deleteParty, getAllParties, updateParty } from '@/controllers/partyController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return run(() => getAllParties(req.nextUrl.searchParams.get('type')))
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => createParty(body), { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await readBody(req)
  return run(() => updateParty(body))
}

export async function DELETE(req: NextRequest) {
  return run(() => deleteParty(req.nextUrl.searchParams.get('id') ?? ''))
}