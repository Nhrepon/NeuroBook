import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { reopenPeriod } from '@/db/repo/fiscalPeriods'
import { audit } from '@/db/repo/audit'
import { z } from 'zod'

const Body = z.object({ label: z.string().min(1) })

// POST /api/v1/periods/reopen — SUPER_ADMIN only; audit-logged.
export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return err({ code: 'VALIDATION', message: 'label is required' }, 400)
  }
  try {
    const row = await reopenPeriod(scope, parsed.data.label)
    await audit(scope, {
      action: 'period.reopen',
      resourceType: 'fiscal_period',
      resourceId: row.id,
      after: { label: parsed.data.label },
    })
    return ok(row)
  } catch (e) {
    return err({ code: 'FORBIDDEN', message: (e as Error).message }, 403)
  }
}
