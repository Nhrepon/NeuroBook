import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me-please-32-chars')

/** What a token carries: who, in which company, as what, and which token generation. */
export interface TokenClaims {
  sub: string
  tid: string
  role: string
  ver: number
}

export async function signToken(payload: TokenClaims) {
  return new SignJWT(payload as unknown as Record<string, unknown>).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('15m').sign(secret)
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret)
  return payload as unknown as TokenClaims
}
