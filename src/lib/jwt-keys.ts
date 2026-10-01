// RS256 key management (§6.1).
//
// jose's sign/verify do NOT accept PEM strings — they need a CryptoKey,
// KeyObject, JWK, or DER byte buffer. So we import the keys through
// WebCrypto (available in both the edge middleware and Node route
// handlers) into CryptoKeys and hand those to jose.
//
// - Production: set JWT_PRIVATE_KEY_B64 / JWT_PUBLIC_KEY_B64 (base64 of the
//   PEM). Store base64, not raw PEM, because dotenv values are single-line
//   and PEM newlines need escaping that dotenv does not parse reliably.
// - Development: run `node apps/web/scripts/generate-jwt-keys.mjs`.
//
// No `node:crypto` import: this module is also loaded from the edge
// middleware, where node builtins are unavailable. `crypto.subtle`
// (WebCrypto) is present in both runtimes.
export interface JwtKeys {
  alg: 'RS256'
  kid: string
  privateKey: CryptoKey
  publicKey: CryptoKey
}

let cached: Promise<JwtKeys> | null = null

export function getJwtKeys(): Promise<JwtKeys> {
  if (!cached) cached = loadKeys()
  return cached
}

async function loadKeys(): Promise<JwtKeys> {
  const privateKeyPem = b64ToPem(process.env.JWT_PRIVATE_KEY_B64)
  const publicKeyPem = b64ToPem(process.env.JWT_PUBLIC_KEY_B64)
  if (!privateKeyPem || !publicKeyPem) {
    throw new Error(
      'JWT_PRIVATE_KEY_B64 / JWT_PUBLIC_KEY_B64 are not set. ' +
        'Run `node apps/web/scripts/generate-jwt-keys.mjs` for development, ' +
        'or set them from your KMS in production.',
    )
  }

  const subtle = crypto.subtle
  const rsaParams = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
  const privateKey = await subtle.importKey(
    'pkcs8',
    pemToDer(privateKeyPem),
    rsaParams,
    false,
    ['sign'],
  )
  const publicKey = await subtle.importKey(
    'spki',
    pemToDer(publicKeyPem),
    rsaParams,
    true,
    ['verify'],
  )

  return {
    alg: 'RS256',
    kid: process.env.JWT_KID ?? 'prod-1',
    privateKey,
    publicKey,
  }
}

// base64 env value -> PEM text (single-line base64, no escaping needed).
function b64ToPem(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  try {
    return atob(raw)
  } catch {
    return undefined
  }
}

// PEM text -> DER bytes for WebCrypto importKey.
function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----[A-Z ]+-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  // `Uint8Array.from(binary)` is a trap: it coerces each *character* through
  // ToNumber (→ 0), producing an all-zero buffer. Use charCodeAt explicitly.
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
