// Auth verification + tenant scope (Next.js 16 proxy convention; was
// middleware.ts). Runs on every request, including RSC fetches and Route
// Handlers. Verifies RS256 JWT (R9/R10) and sets the tenant id on the
// request scope so unscoped queries are blocked at the repository layer.
import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { getJwtKeys } from '@/lib/jwt-keys'

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/api/v1/auth/login', '/api/v1/auth/refresh']
const STATIC_PREFIXES = ['/_next', '/favicon.ico', '/public']

interface JwtPayload {
  sub: string
  tid: string
  role: string
  exp: number
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const token =
    req.cookies.get('access_token')?.value ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!token) {
    return redirectToLogin(req)
  }

  try {
    const { publicKey } = await getJwtKeys()
    const { payload } = await jwtVerify<JwtPayload>(token, publicKey, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    })

    // Surface tenant + user on downstream handlers via request headers.
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-tenant-id', payload.tid)
    requestHeaders.set('x-user-id', payload.sub)
    requestHeaders.set('x-user-role', payload.role)

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    return redirectToLogin(req)
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', req.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = {
  // Skip static assets and the public health/readiness probes — the
  // probes are what uptime monitors call, and they must work unauthenticated.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|api/ready|api/v1/health).*)',
  ],
}
