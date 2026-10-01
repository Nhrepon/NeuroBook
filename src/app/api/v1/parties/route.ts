import { NextRequest } from 'next/server'
import { ok, created, err } from '../route'
import { requireScope } from '@/db/scope'
import { listParties, createParty } from '@/db/repo/parties'
import { audit } from '@/db/repo/audit'
import { PartySchema, PartyTypeSchema } from '@neurobook/shared'

// GET /api/v1/parties?type=CUSTOMER|SUPPLIER|BOTH
export async function GET(req: NextRequest) {
  const scope = await requireScope()
  const type = req.nextUrl.searchParams.get('type')
  const parsedType = type ? PartyTypeSchema.safeParse(type) : undefined
  return ok(await listParties(scope, parsedType?.success ? parsedType.data : undefined))
}

// POST /api/v1/parties
export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const parsed = PartySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return err({ code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
  }
  const row = await createParty(scope, parsed.data)
  await audit(scope, { action: 'party.create', resourceType: 'party', resourceId: row.id })
  return created(row)
}
