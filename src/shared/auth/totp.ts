// R12: TOTP 2FA (RFC 6238). WebCrypto HMAC-SHA1 — works in edge and node.
// Shared so web and any test harness use the exact same implementation.
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export interface TotpOptions {
  secret: string      // base32
  period?: number     // seconds, default 30
  digits?: number     // default 6
  window?: number     // ± N periods to tolerate clock skew, default 1
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | (bytes[i] ?? 0)
    bits += 8
    while (bits >= 5) {
      out += B32_ALPHABET.charAt((value >>> (bits - 5)) & 31)
      bits -= 5
    }
  }
  if (bits > 0) out += B32_ALPHABET.charAt((value << (5 - bits)) & 31)
  return out
}

export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/=+$/, '')
  const bytes = new Uint8Array(Math.floor((clean.length * 5) / 8))
  let bits = 0
  let value = 0
  for (let i = 0; i < clean.length; i++) {
    value = (value << 5) | B32_ALPHABET.indexOf(clean.charAt(i))
    bits += 5
    if (bits >= 8) {
      bytes[Math.floor((i * 5) / 8)] = (value >>> (bits - 8)) & 0xff
      bits -= 8
      value &= (1 << bits) - 1
    }
  }
  return bytes
}

export function generateSecret(byteLength = 20): string {
  const raw = new Uint8Array(byteLength)
  crypto.getRandomValues(raw)
  return base32Encode(raw)
}

async function hotp(secret: string, counter: number, digits: number): Promise<string> {
  const rawKey = base32Decode(secret)
  // Copy into a fresh ArrayBuffer: base32Decode may return a view over a
  // larger buffer, and importKey rejects a non-exact view in some runtimes.
  const keyBytes = new Uint8Array(rawKey.length)
  keyBytes.set(rawKey)
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const msg = new ArrayBuffer(8)
  ;(new BigUint64Array(msg))[0] = BigInt(counter)
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg))
  const offset = (sig[sig.length - 1] ?? 0) & 0x0f
  const val =
    (((sig[offset] ?? 0) & 0x7f) << 24) |
    (((sig[offset + 1] ?? 0) & 0xff) << 16) |
    (((sig[offset + 2] ?? 0) & 0xff) << 8) |
    ((sig[offset + 3] ?? 0) & 0xff)
  return String(val % 10 ** digits).padStart(digits, '0')
}

/** Current TOTP code. `now` is overridable for tests. */
export async function totpGenerate(
  opts: TotpOptions,
  now: number = Date.now(),
): Promise<string> {
  const period = opts.period ?? 30
  const digits = opts.digits ?? 6
  const counter = Math.floor(now / 1000 / period)
  return hotp(opts.secret, counter, digits)
}

/**
 * Verify a code, tolerating ±window periods of clock skew.
 */
export async function totpVerify(
  code: string,
  opts: TotpOptions,
  now: number = Date.now(),
): Promise<boolean> {
  const period = opts.period ?? 30
  const digits = opts.digits ?? 6
  const window = opts.window ?? 1
  const base = Math.floor(now / 1000 / period)
  for (let i = base - window; i <= base + window; i++) {
    if (await hotp(opts.secret, i, digits) === code) return true
  }
  return false
}
