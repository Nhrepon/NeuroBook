// Tiny ulid/uuid helpers. Pure JS so the shared package has no Node deps.
export function ulidLike(): string {
  // Crockford base32 timestamp + random. Sufficient for non-cryptographic
  // IDs in client code (server uses gen_random_uuid() in Drizzle).
  const time = Date.now().toString(32).toUpperCase().padStart(10, '0')
  let rand = ''
  for (let i = 0; i < 16; i++) rand += Math.floor(Math.random() * 32).toString(32).toUpperCase()
  return `${time}${rand}`
}
