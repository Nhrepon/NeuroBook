import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { getParty, updateParty, deactivateParty } from '@/db/repo/parties'
import { audit } from '@/db/repo/audit'
import { z } from 'zod'

const Patch = z.object({
  name: z.string().min(1).max(200).optional(),
  contactPerson: z.string().max(200).optional(),
  phone: z.string().max(32).optional(),
  email: z.string().email().max(200).optional(),
  bin: z.string().max(32).optional(),
  tin: z.string().max(32).optional(),
  address: z.string().max(500).optional(),
  division: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  upazila: z.string().max(100).optional(),
  union: z.string().max(100).optional(),
})

// GET /api/v1/parties/:id
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()
  const row = await getParty(scope, id)
  if (!row) return err({ code: 'NOT_FOUND', message: 'Party not found' }, 404)
  return ok(row)
}

// PATCH /api/v1/parties/:id
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()
  const parsed = Patch.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return err({ code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
  }
  const row = await updateParty(scope, id, parsed.data)
  if (!row) return err({ code: 'NOT_FOUND', message: 'Party not found' }, 404)
  await audit(scope, { action: 'party.update', resourceType: 'party', resourceId: id, after: parsed.data })
  return ok(row)
}
