/**
 * Middleware — auth and tenant scope (§15.2 R9/R10).
 *
 * Every request that is not public is verified here. The refresh token lives in a
 * HttpOnly cookie. The access token scope is set as response headers for pages
 * to read from headers().
 *
 * Flow:
 *   refresh cookie present → verify refresh → sign a fresh access token
 *   access cookie present → verify access token
 *   neither → redirect to /login or 401 for API routes
 */
import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@neurobook/shared";

const PUBLIC_PATHS = [
  "/login", "/register",
  "/_next/", "/favicon",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const refresh = request.cookies.get("nb-refresh")?.value ?? null;
  const access = request.cookies.get("nb-access")?.value ?? null;

  // Prefer the access token if valid; fall back to refresh.
  let claims = access ? await verifyToken(access, "access") : null;
  if (!claims) {
    claims = refresh ? await verifyToken(refresh, "refresh") : null;
  }

  if (!claims) {
    return unauthorized(request);
  }

  // Set the three scope headers from the verified claims. Pages read them via headers().
  const response = NextResponse.next();
  response.headers.set("x-tenant-id", claims.tid ?? "");
  response.headers.set("x-user-id", claims.sub ?? "");
  response.headers.set("x-session-id", claims.sid ?? "");
  return response;
}

function unauthorized(req: NextRequest): NextResponse {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
