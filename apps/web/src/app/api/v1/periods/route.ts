import { NextRequest } from 'next/server'
import { createPeriod, getAllPeriods, updatePeriod } from '@/controllers/periodController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(getAllPeriods)
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => createPeriod(body), { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await readBody(req)
  return run(() => updatePeriod(body))
}