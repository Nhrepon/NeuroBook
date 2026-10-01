// R12: TOTP 2FA. Enable for a user; verify at login; required for
// ADMIN + SUPER_ADMIN (the repo refuses to issue their access token
// without a valid TOTP code — see the auth.login flow).
import { db } from '../client'
import { users } from '../schema/auth'
import { and, eq } from 'drizzle-orm'
import { generateSecret, totpVerify, type TotpOptions } from '@/shared/auth'
import type { RequestScope } from '../scope'

export async function enableTotp(scope: RequestScope, userId: string): Promise<string> {
  const secret = generateSecret()
  const [row] = await db
    .update(users)
    .set({ totpSecret: secret, totpEnabled: true })
    .where(and(eq(users.id, userId), eq(users.tenantId, scope.tenantId)))
    .returning()
  if (!row) throw new Error('User not found or wrong tenant.')
  return secret
}

export async function disableTotp(scope: RequestScope, userId: string) {
  await db
    .update(users)
    .set({ totpSecret: null, totpEnabled: false })
    .where(and(eq(users.id, userId), eq(users.tenantId, scope.tenantId)))
}

/** Verify the caller's TOTP code against the stored secret. */
export async function verifyUserTotp(
  scope: RequestScope,
  code: string,
): Promise<boolean> {
  const [row] = await db
    .select({ totpSecret: users.totpSecret, totpEnabled: users.totpEnabled })
    .from(users)
    .where(and(eq(users.id, scope.userId), eq(users.tenantId, scope.tenantId)))
  if (!row || !row.totpEnabled || !row.totpSecret) return false
  const opts: TotpOptions = { secret: row.totpSecret }
  return totpVerify(code, opts)
}
