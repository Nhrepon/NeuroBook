/**
 * Print an Argon2id hash for a password, so the seed can be given a real
 * credential instead of a placeholder value that can never log in.
 *
 * Usage: `npm run db:hash -- <password>`, then export SEED_PASSWORD_HASH.
 */
import { hashPassword } from "@neurobook/shared";

async function main(): Promise<void> {
  const password = process.argv[2];
  if (!password) {
    console.error("usage: npm run db:hash -- <password>");
    process.exit(1);
  }
  const hashed = await hashPassword(password);
  console.log(hashed);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
