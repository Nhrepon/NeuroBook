// Generate an RS256 keypair for development and append it to .env.
// Production keys come from your KMS — this script is dev-only.
//
// Keys are stored BASE64, not raw PEM: dotenv values are single-line,
// and PEM newlines would need escaping that dotenv does not parse
// reliably. Base64 is single-line, zero-escape, and decodes back to the
// exact PEM bytes.
import { generateKeyPairSync } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicExponent: 0x10001,
})

// export() returns a PEM *string* — wrap in Buffer first; a bare
// string.toString('base64') returns the string unchanged (silent bug).
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' })
const pubPem = publicKey.export({ type: 'spki', format: 'pem' })
const privB64 = Buffer.from(privPem, 'utf8').toString('base64')
const pubB64 = Buffer.from(pubPem, 'utf8').toString('base64')

const envPath = resolve(process.cwd(), '.env')
let existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
// Drop any older PEM-form entries so we never have two conflicting pairs.
existing = existing
  .split('\n')
  .filter((l) => !/^JWT_(PRIVATE|PUBLIC)_KEY_(PEM|B64)/.test(l))
  .join('\n')

const lines = [
  existing,
  `# --- JWT keypair (generated ${new Date().toISOString()}; dev only) ---`,
  `JWT_PRIVATE_KEY_B64=${privB64}`,
  `JWT_PUBLIC_KEY_B64=${pubB64}`,
  `JWT_KID=dev-1`,
  '',
]
  .filter((l) => l.length > 0 || true)
  .join('\n')

writeFileSync(envPath, lines.replace(/\n{3,}/g, '\n\n'))
console.log(`Wrote base64 JWT keypair to ${envPath} (JWT_KID=dev-1)`)
