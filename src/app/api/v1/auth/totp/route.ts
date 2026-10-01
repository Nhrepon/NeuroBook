import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { enableTotp, disableTotp } from '@/db/repo/twofactor'
import { audit } from '@/db/repo/audit'

// POST /api/v1/auth/totp — enable 2FA, returns the base32 secret to enroll.
export async function POST() {
  const scope = await requireScope()
  try {
    const secret = await enableTotp(scope, scope.userId)
    await audit(scope, { action: 'user.totp.enable', resourceType: 'user', resourceId: scope.userId })
    return ok({ secret, enrolled: true })
  } catch (e) {
    return err({ code: 'INTERNAL', message: (e as Error).message }, 500)
  }
}

// DELETE /api/v1/auth/totp — disable 2FA for the caller.
export async function DELETE() {
  const scope = await requireScope()
  await disableTotp(scope, scope.userId)
  await audit(scope, { action: 'user.totp.disable', resourceType: 'user', resourceId: scope.userId })
  return ok({ disabled: true })
}
