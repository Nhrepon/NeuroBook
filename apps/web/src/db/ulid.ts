/**
 * ULID generation (RFC 9562).
 *
 * Used for every primary key: monotonic, sortable by creation time and short
 * enough to fit the schema's varchar(26). The random suffix is 80 bits of
 * entropy, so ids generated in the same millisecond still do not collide.
 */

import { randomBytes } from "node:crypto";

// Crockford base32, per the ULID spec.
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 48 bits of milliseconds + 80 bits of randomness, base32-encoded to 26 chars. */
export function ULID(now: number = Date.now()): string {
  const time = BigInt(now);
  const random = randomBytes(10);
  let out = "";

  // Time part: 48 bits -> 10 characters, most significant first.
  let t = time;
  const timeChars: string[] = [];
  for (let i = 0; i < 10; i++) {
    timeChars.unshift(ENCODING[Number(t % 32n)] ?? "?");
    t /= 32n;
  }
  out += timeChars.join("");

  // Random part: 80 bits -> 16 characters.
  let r = 0n;
  for (const byte of random) r = (r << 8n) | BigInt(byte);
  const randChars: string[] = [];
  for (let i = 0; i < 16; i++) {
    randChars.unshift(ENCODING[Number(r % 32n)] ?? "?");
    r /= 32n;
  }
  out += randChars.join("");

  return out;
}
