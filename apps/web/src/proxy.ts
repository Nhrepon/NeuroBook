import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { can, canAny, normalizeRole } from '@neurobook/shared'
import { pagePermission, requiredPermissions } from '@/lib/rbac'
import { db } from '@/lib/db/client'
import { tenants, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me-please-32-chars')

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/health',
  '/api/ready',
]

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

function isApi(pathname: string) {
  return pathname.startsWith('/api/')
}

function unauthorized(pathname: string, req: NextRequest) {
  if (isApi(pathname)) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    )
  }
  return NextResponse.redirect(new URL('/login', req.url))
}

function forbidden(pathname: string, req: NextRequest) {
  if (isApi(pathname)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action' } },
      { status: 403 },
    )
  }
  const url = new URL('/dashboard', req.url)
  url.searchParams.set('denied', '1')
  return NextResponse.redirect(url)
}

function sessionRevoked(pathname: string, req: NextRequest) {
  if (isApi(pathname)) {
    return NextResponse.json(
      { error: { code: 'SESSION_REVOKED', message: 'Your session is no longer valid. Sign in again.' } },
      { status: 401 },
    )
  }
  const res = NextResponse.redirect(new URL('/login?expired=1', req.url))
  res.headers.set('Set-Cookie', 'access_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
  return res
}

/** The session's company has been suspended or archived; it can no longer operate. */
function companyInactive(pathname: string, req: NextRequest) {
  if (isApi(pathname)) {
    return NextResponse.json(
      { error: { code: 'TENANT_INACTIVE', message: 'This company is suspended. Contact your administrator.' } },
      { status: 403 },
    )
  }
  const res = NextResponse.redirect(new URL('/login?suspended=1', req.url))
  res.headers.set('Set-Cookie', 'access_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
  return res
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  /**
   * Hands the handler the endpoint that is about to run, so the audit row it
   * writes can name it. Public routes (login, register) get it too — they audit
   * as well, they just have no token to resolve a role from.
   */
  function withRoute(base: HeadersInit, extra?: (h: Headers) => void) {
    const headers = new Headers(base)
    headers.set('x-audit-route', `${req.method} ${pathname}`)
    extra?.(headers)
    return headers
  }

  if (isPublic(pathname)) return NextResponse.next({ request: { headers: withRoute(req.headers) } })
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/manifest')) {
    return NextResponse.next()
  }

  const token = req.cookies.get('access_token')?.value ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return unauthorized(pathname, req)

  let payload: { sub?: unknown; tid?: unknown; role?: unknown; ver?: unknown }
  try {
    payload = (await jwtVerify(token, secret)).payload
  } catch {
    return unauthorized(pathname, req)
  }

  if (!payload.sub || !payload.tid) return unauthorized(pathname, req)

  /**
   * The token is only half the story: the session it claims has to still exist.
   * The user must be active, still belong to the company the token names (a move
   * ends the session), and carry the same token generation the account is on, so
   * a role change, deactivation or password reset kills every live token instead
   * of letting it run to its 15-minute expiry. The role is taken from the row, not
   * the token, so a demotion takes effect at once.
   */
  const sub = String(payload.sub)
  const tid = String(payload.tid)
  const [session] = await db
    .select({
      role: users.role,
      active: users.active,
      tenantId: users.tenantId,
      tokenVersion: users.tokenVersion,
      tenantStatus: tenants.status,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(eq(users.id, sub))

  if (
    !session ||
    !session.active ||
    session.tenantId !== tid ||
    session.tokenVersion !== Number(payload.ver ?? -1)
  ) {
    return sessionRevoked(pathname, req)
  }

  if (session.tenantStatus !== 'active') return companyInactive(pathname, req)

  const role = normalizeRole(session.role)

  // Role-based enforcement for API mutations.
  const apiPermissions = requiredPermissions(req.method, pathname)
  if (apiPermissions && !canAny(role, apiPermissions)) return forbidden(pathname, req)

  // Role-based enforcement for admin-only pages.
  const needed = pagePermission(pathname)
  if (needed && !can(role, needed)) return forbidden(pathname, req)

  const headers = withRoute(req.headers, (h) => {
    h.set('x-tenant-id', tid)
    h.set('x-user-id', sub)
    h.set('x-user-role', role)
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (forwarded) h.set('x-forwarded-for', forwarded)
    // Never trust tenant identity supplied by the client.
    h.delete('x-tenant-scope')
  })

  return NextResponse.next({ request: { headers } })
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
