// Phase 5 — backup create/list/restore. Stubs.
import { NextRequest } from 'next/server'
import { ok } from '@/lib/envelope'
import { requireScope } from '@/db/scope'

export async function GET() {
  const scope = await requireScope()
  void scope
  return ok({ backups: [] })
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  void scope
  void body
  return ok({ id: 'pending' })
}
