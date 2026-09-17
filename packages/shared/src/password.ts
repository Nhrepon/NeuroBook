/**
 * Password hashing — §15.2 R11.
 *
 * Argon2id is the OWASP-recommended function; bcrypt is not (it is
 * GPU-cheaper to attack and unsuited to the memory-hardness property we want).
 */
import { hash, verify, type Options } from "@node-rs/argon2";

// `Algorithm.Argon2id` is a numeric const enum (2), which cannot be re-exported
// across a package boundary under `verbatimModuleSyntax`. The value is used
// directly; argon2's native binding reads it as the algorithm selector.
const OPTIONS: Options = {
  algorithm: 2 as never,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plaintext: string): Promise<string> {
  if (plaintext.length < 8) {
    throw new Error("password must be at least 8 characters");
  }
  return hash(plaintext, OPTIONS);
}

/**
 * Verify a password against a stored hash.
 *
 * A missing or malformed hash returns false rather than throwing, so a
 * corrupted row degrades to "cannot log in" instead of a 500.
 */
export async function verifyPassword(
  plaintext: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  try {
    return await verify(stored, plaintext);
  } catch {
    return false;
  }
}
