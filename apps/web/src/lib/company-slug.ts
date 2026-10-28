/**
 * Lowercase, ASCII, dash-separated company code derived from a company name.
 * Returns an empty string when nothing usable is left, so callers can decide on a
 * fallback. Shared by the register and create-company forms and the server.
 */
export function baseSlug(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}
