// R11: Argon2id password hashing. Interface — the actual implementation
// lives in apps/web (argon2 package, server-only) and is exposed to tests
// via a thin wrapper.
export interface PasswordHasher {
  hash(plain: string): Promise<string>
  verify(plain: string, encoded: string): Promise<boolean>
}

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 200
