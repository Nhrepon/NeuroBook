import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me-please-32-chars')

const PUBLIC_PATHS = ['/login', '/register', '/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/health']

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next()
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next()

  const token = req.cookies.get('access_token')?.value ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const { payload } = await jwtVerify(token, secret)
    const headers = new Headers(req.headers)
    headers.set('x-tenant-id', String(payload.tid))
    headers.set('x-user-id', String(payload.sub))
    headers.set('x-user-role', String(payload.role))
    return NextResponse.next({ request: { headers } })
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health|api/ready).*)'] }
