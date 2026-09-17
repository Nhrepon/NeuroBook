/**
 * JWT signing — §15.2 R11/R13.
 *
 * RS256 with a `kid` header so keys can be rotated without invalidating every
 * outstanding token: the verifier trusts a set of kids, and a new key pair is
 * added before the old one is retired.
 */
import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, importPKCS8, importSPKI, type JWTPayload } from "jose";
import { loadEnv } from "./env.js";

export interface NeuroBookClaims extends JWTPayload {
  sub: string;
  /** Default tenant for the session. */
  tid: string;
  role: string;
  /** Token type, so an access token cannot be replayed as a refresh. */
  typ: "access" | "refresh";
  sid: string;
}

let privateKey: CryptoKey | null = null;
let publicKey: CryptoKey | null = null;

async function keys(): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey }> {
  if (privateKey && publicKey) return { privateKey, publicKey };

  const env = loadEnv();
  [privateKey, publicKey] = await Promise.all([
    importPKCS8(env.JWT_PRIVATE_KEY, "RS256"),
    importSPKI(env.JWT_PUBLIC_KEY, "RS256"),
  ]);
  return { privateKey, publicKey };
}

/**
 * Issue an access token. Short-lived (15 min default) and carried in
 * `Authorization: Bearer`; the refresh token is the long-lived one and lives
 * in a revocable server-side row (R13).
 */
export async function signAccessToken(claims: {
  userId: string;
  tenantId: string;
  role: string;
  sessionId: string;
}): Promise<string> {
  const { privateKey } = await keys();
  const env = loadEnv();

  return new SignJWT({
    sub: claims.userId,
    tid: claims.tenantId,
    role: claims.role,
    typ: "access",
    sid: claims.sessionId,
  })
    .setProtectedHeader({ alg: "RS256", kid: env.JWT_KID })
    .setIssuedAt()
    .setIssuer("neurobook")
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(privateKey);
}

export async function signRefreshToken(claims: {
  userId: string;
  tenantId: string;
  role: string;
  sessionId: string;
}): Promise<string> {
  const { privateKey } = await keys();
  const env = loadEnv();

  return new SignJWT({
    sub: claims.userId,
    tid: claims.tenantId,
    role: claims.role,
    typ: "refresh",
    sid: claims.sessionId,
  })
    .setProtectedHeader({ alg: "RS256", kid: env.JWT_KID })
    .setIssuedAt()
    .setIssuer("neurobook")
    .setExpirationTime(`${env.REFRESH_TOKEN_TTL_DAYS}d`)
    .sign(privateKey);
}

/**
 * Verify a token and return its claims, or null if invalid/expired.
 *
 * Null rather than a throw keeps the middleware path simple: an unverified
 * request is an unauthenticated request.
 */
export async function verifyToken(
  token: string,
  expectedType?: "access" | "refresh",
): Promise<NeuroBookClaims | null> {
  try {
    const { publicKey } = await keys();
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: "neurobook",
    });
    const claims = payload as NeuroBookClaims;
    if (expectedType && claims.typ !== expectedType) return null;
    if (!claims.sub || !claims.tid) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically random refresh token.
 *
 * The client holds this raw and the server stores only its hash, so it does not
 * need to carry any structure — just 48 bytes of entropy.
 */
export function generateRefreshTokenValue(): string {
  return randomBytes(48).toString("base64url");
}

/** Hash a refresh token before storing it; only the client ever holds the raw. */
export async function hashToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
