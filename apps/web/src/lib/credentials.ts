import argon2 from 'argon2'

/**
 * Valid argon2id hash used only to keep verification timing uniform when the
 * account does not exist (unknown email, wrong company code, inactive user).
 */
export const DUMMY_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$S/6U0ypzke3TlJE6gRlK7g$Ga+IuqLw8GYCGhNj3kxFA5BSfBtMD7XtMaK/qfn3KjM'

/** Constant-time password check that always does the work, even without a stored hash. */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  try {
    return await argon2.verify(hash ?? DUMMY_HASH, password)
  } catch {
    return false
  }
}
