// One-shot: rebuild apps/web/.env from .env.example + the base64 key lines.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const root = resolve(process.cwd(), '../..')
const envPath = resolve(process.cwd(), '.env')
const examplePath = resolve(root, '.env.example')

const example = readFileSync(examplePath, 'utf8')

// The base64 keypair (from the latest generate-jwt-keys run). Only lines
// whose value is *valid* base64 are kept — an earlier generator bug
// emitted raw PEM here, and the PEM lines must not survive the clean.
const current = readFileSync(envPath, 'utf8')
const keyLines = current
  .split(/\r?\n/)
  .filter((l) => {
    const m = l.match(/^JWT_(?:PRIVATE|PUBLIC)_KEY_B64=([A-Za-z0-9+/=]+)$/)
    if (!m) return false
    const decoded = Buffer.from(m[1], 'base64').toString('utf8')
    return decoded.startsWith('-----BEGIN')
  })

const lines = [
  '# neurobook web dev environment',
  'NODE_ENV=development',
  'DATABASE_URL=postgresql://neurobook:neurobook@localhost:5432/neurobook_dev',
  'REDIS_URL=redis://localhost:6379',
  '',
  ...keyLines,
  'JWT_KID=dev-1',
  'JWT_REFRESH_SECRET=replace-me-different-min-32-bytes',
  'JWT_ISSUER=neurobook',
  'JWT_AUDIENCE=neurobook.web',
  '',
  'STORAGE_BUCKET=neurobook-uploads',
  'S3_ENDPOINT=http://localhost:9000',
  'S3_REGION=us-east-1',
  'S3_ACCESS_KEY=minio',
  'S3_SECRET_KEY=minio12345',
  '',
  'SMTP_HOST=smtp.example.com',
  'SMTP_PORT=587',
  'SMTP_USER=apikey',
  'SMTP_PASS=test',
  'EMAIL_FROM="NeuroBook <no-reply@neurobook.app>"',
  '',
  'LOG_LEVEL=info',
  '',
  `# (mirror of ${examplePath.split(/[\\/]/).slice(-2).join('/')} — real values stay here, gitignored)`,
]

if (keyLines.length < 2) {
  console.error('No base64 keypair found in .env — run generate-jwt-keys.mjs first.')
  process.exit(1)
}

writeFileSync(envPath, lines.join('\n') + '\n')
console.log(`Rewrote ${envPath} (${keyLines.length} key lines, ${lines.length} total)`)
