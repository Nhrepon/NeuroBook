/** Taka text -> number. Tolerates grouping commas, spaces and the ৳ sign. */
export function parseTaka(value: string): number {
  const cleaned = value.replace(/[,\s৳]/g, '')
  if (!cleaned) return 0
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function sanitizeAmount(value: string): string {
  return value.replace(/[^\d.,]/g, '')
}
