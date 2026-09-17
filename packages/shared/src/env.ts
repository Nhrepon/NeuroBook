/**
 * Environment schema — §15.5 O5.
 *
 * Secrets never live in the repo: this file documents them and validates at
 * boot, so a missing or malformed required key fails loudly on startup with
 * a named error, instead of surfacing as a confusing 500 mid-request.
 */
import { z } from "zod";

const booleanish = z
  .string()
  .optional()
  .transform((v) => v === "1" || v === "true");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required — the app cannot run without a database")
    .describe("Postgres connection string. Must point at a non-superuser role in production."),

  REDIS_URL: z.string().optional(),

  /** RS256 private key (PEM) for signing access tokens. */
  JWT_PRIVATE_KEY: z
    .string()
    .min(1, "JWT_PRIVATE_KEY is required — a PEM private key for signing access tokens"),
  JWT_PUBLIC_KEY: z
    .string()
    .min(1, "JWT_PUBLIC_KEY is required — the matching PEM public key"),
  /** Key id for rotation (§15.2 R11 note in the doc: rotate via kid). */
  JWT_KID: z.string().min(1).default("neurobook-1"),

  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  STORAGE_BUCKET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  /** Phase 2: swaps the Drizzle adapter from Postgres to local SQLite. */
  ELECTRON: booleanish.default("0"),

  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Parse and validate the environment. Throws on the first violation with a
 * message naming the offending key, so the process dies at boot (O5).
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const name = first?.path.filter(Boolean).join(".") || "unknown";
    throw new Error(
      `Invalid environment: ${name} — ${first?.message ?? "validation failed"}. ` +
        "Copy .env.example to .env and fill in the required values.",
    );
  }
  cached = parsed.data;
  return cached;
}

/** Test hook: clear the cache between cases. */
export function resetEnvCache(): void {
  cached = null;
}
