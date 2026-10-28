import { NextRequest } from 'next/server'
import { can } from '@neurobook/shared'
import { forbiddenResponse, requireScope } from '@/db/scope'
import { findSwitchTarget, sessionProfile } from '@/lib/tenant-membership'
import { signToken } from '@/lib/jwt'
import { verifyPassword } from '@/lib/credentials'
import { writeAudit } from '@/lib/audit'

/**
 * Moves the session to another company.
 *
 * The password checked here is the **company** password, not the person's login
 * password: it belongs to the tenant and is shared by whoever is allowed to
 * switch into it.
 *
 * ADMIN (`tenant:manage`) may enter any company by its code, with or without a
 * membership row — that is the operator path. Everyone else needs a membership
 * row in the target company, so a company password alone can never open a
 * company they do not belong to.
 */
export async function POST(req: NextRequest) {
  const scope = await requireScope()
  if (!can(scope.role, 'tenant:switch')) return forbiddenResponse()

  const body = await req.json().catch(() => null)
  const slug = String(body?.tenantSlug ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')

  if (!slug || !password) {
    return Response.json({ error: { code: 'VALIDATION', message: 'tenantSlug and password required' } }, { status: 400 })
  }

  const me = await sessionProfile(scope)
  if (!me) return Response.json({ error: { code: 'NOT_FOUND', message: 'user not found' } }, { status: 404 })

  const target = await findSwitchTarget(scope, me.email, slug)
  if (!target) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'This company password does not match, or you are not a member.' } },
      { status: 401 },
    )
  }

  if (target.tenantId === scope.tenantId) {
    return Response.json(
      { error: { code: 'ALREADY_IN_TENANT', message: 'This company is already selected.' } },
      { status: 409 },
    )
  }

  if (!target.tenantPasswordHash) {
    return Response.json(
      {
        error: {
          code: 'TENANT_PASSWORD_REQUIRED',
          message: 'This company has no company password yet. Its admin has to set one in Settings.',
        },
      },
      { status: 409 },
    )
  }

  if (!(await verifyPassword(password, target.tenantPasswordHash))) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'This company password does not match, or you are not a member.' } },
      { status: 401 },
    )
  }

  const token = await signToken({ sub: target.userId, tid: target.tenantId, role: target.role })
  const res = Response.json({
    data: {
      accessToken: token,
      user: { id: target.userId, email: me.email, role: target.role },
      tenant: { slug: target.slug, name: target.tenantName },
      membership: target.member,
    },
  })
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.headers.set('Set-Cookie', `access_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900${secure}`)

  void writeAudit({
    tenantId: target.tenantId,
    userId: target.userId,
    action: 'auth.tenant_switch',
    resourceType: 'tenant',
    resourceId: target.tenantId,
    before: { tenantId: scope.tenantId },
    after: { tenantId: target.tenantId, slug: target.slug, via: 'company-password', as: target.member ? 'member' : 'admin' },
  }).catch(() => {})

  return res
}
