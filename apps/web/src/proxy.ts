import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { can, canAny, normalizeRole } from '@neurobook/shared'
import { pagePermission, requiredPermissions } from '@/lib/rbac'

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

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (isPublic(pathname)) return NextResponse.next()
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/manifest')) {
    return NextResponse.next()
  }

  const token = req.cookies.get('access_token')?.value ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return unauthorized(pathname, req)

  let payload: { sub?: unknown; tid?: unknown; role?: unknown }
  try {
    payload = (await jwtVerify(token, secret)).payload
  } catch {
    return unauthorized(pathname, req)
  }

  if (!payload.sub || !payload.tid) return unauthorized(pathname, req)
  const role = normalizeRole(payload.role)

  // Role-based enforcement for API mutations.
  const apiPermissions = requiredPermissions(req.method, pathname)
  if (apiPermissions && !canAny(role, apiPermissions)) return forbidden(pathname, req)

  // Role-based enforcement for admin-only pages.
  const needed = pagePermission(pathname)
  if (needed && !can(role, needed)) return forbidden(pathname, req)

  const headers = new Headers(req.headers)
  headers.set('x-tenant-id', String(payload.tid))
  headers.set('x-user-id', String(payload.sub))
  headers.set('x-user-role', role)
  // Never trust tenant identity supplied by the client.
  headers.delete('x-tenant-scope')

  return NextResponse.next({ request: { headers } })
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
