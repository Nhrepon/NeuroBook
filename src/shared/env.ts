// Centralized env validation. One place that throws at boot if a key is
// missing — never a half-configured deploy. See O5.
import { z } from 'zod'

const ServerEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('neurobook'),
  JWT_AUDIENCE: z.string().default('neurobook.web'),
  STORAGE_BUCKET: z.string().min(1),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

const PublicEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url(),
  EXPO_PUBLIC_APP_VERSION: z.string().min(1),
})

export type ServerEnv = z.infer<typeof ServerEnvSchema>
export type PublicEnv = z.infer<typeof PublicEnvSchema>

export function parseServerEnv(env: Record<string, string | undefined>): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid server env:\n${issues}`)
  }
  return parsed.data
}

export function parsePublicEnv(env: Record<string, string | undefined>): PublicEnv {
  const parsed = PublicEnvSchema.safeParse(env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid public env:\n${issues}`)
  }
  return parsed.data
}
