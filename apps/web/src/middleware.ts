/**
 * Middleware — auth and tenant scope (§15.2 R9, R10).
 *
 * Every request that is not a public asset is verified here, and the tenant is
 * resolved once from the verified token. The tenant id is passed to the
 * request scope so the DB layer can set the RLS GUC; the app-layer filter is
 * defence-in-depth and never the sole guard.
 *
 * Access tokens stay short-lived (15 min) because they cannot be revoked once
 * issued; the refresh token is the revocable server-side row (R13).
 */
import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@neurobook/shared";

/** Paths that need no session. Everything else is behind the token check. */
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/refresh",
  "/api/v1/health",
];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = extractToken(request);
  if (!token) {
    return redirectToLogin(request);
  }

  // An access token is only ever usable as an access token: `typ` is checked
  // on verify, so a refresh token replayed here is rejected outright.
  const claims = await verifyToken(token, "access");
  if (!claims) {
    return redirectToLogin(request);
  }

  const response = NextResponse.next();
  // The tenant is threaded to the request scope for the DB layer to set the
  // RLS GUC. Unscoped queries are blocked at the repository layer (R10).
  response.headers.set("x-tenant-id", claims.tid);
  response.headers.set("x-user-id", claims.sub);
  response.headers.set("x-session-id", claims.sid);
  return response;
}

function extractToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  return null;
}

function redirectToLogin(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    // An API call gets a 401, not a redirect: a fetch cannot follow one.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Static assets and images are excluded; the matcher runs on everything else.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
