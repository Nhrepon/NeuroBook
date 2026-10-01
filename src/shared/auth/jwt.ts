// RS256 JWT with `kid` for key rotation. Pure signing/verification — does
// not hold the keys; the caller passes them in. (Both apps/web and any test
// harness load keys from the platform-appropriate location.)
import type { Role } from '../types'

export interface AccessTokenClaims {
  sub: string          // user id
  tid: string          // tenant id
  role: Role
  iat: number
  exp: number          // 15 min (R13)
  iss: string
  aud: string
  jti: string          // unique per token, used for revocation list
}

export interface RefreshTokenClaims {
  sub: string
  tid: string
  sid: string          // session id (server-side row, R13)
  iat: number
  exp: number          // 7 days
  iss: string
  aud: string
}

export interface SignOptions {
  issuer: string
  audience: string
  accessTtlSeconds?: number
  refreshTtlSeconds?: number
  kid: string
}

export const DEFAULT_ACCESS_TTL = 15 * 60
export const DEFAULT_REFRESH_TTL = 7 * 24 * 60 * 60

// Signature / verification implementations live behind interfaces so the
// platform adapter (Node Web Crypto, jose, react-native-jwt-io, etc.) can be
// injected. The web app and the mobile app each provide their own impl.

export interface JwtSigner {
  signAccess(claims: Omit<AccessTokenClaims, 'iat' | 'exp' | 'iss' | 'aud' | 'jti'>, opts: SignOptions): Promise<{ token: string; jti: string; exp: number }>
  signRefresh(claims: Omit<RefreshTokenClaims, 'iat' | 'exp' | 'iss' | 'aud'>, opts: SignOptions): Promise<{ token: string; exp: number }>
  verifyAccess(token: string, opts: SignOptions): Promise<AccessTokenClaims>
  verifyRefresh(token: string, opts: SignOptions): Promise<RefreshTokenClaims>
  /** R18: client-side exp check, no network round-trip. */
  isExpired(claims: { exp: number }, skewSeconds?: number): boolean
}

export function isExpired(claims: { exp: number }, skewSeconds = 30): boolean {
  return claims.exp * 1000 <= Date.now() + skewSeconds * 1000
}
