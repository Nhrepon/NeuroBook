// R7: Money is integer minor units (taka × 100). Never float/double in any
// money path. Tax computed at millitaka (3 dp) for fractional cases, then
// rounded per line. Residual posted to a per-company Rounding Difference
// account so the voucher always balances exactly.

const MINOR_PER_MAJOR = 100

/** Convert a major-unit decimal string ("123.45") to minor units. */
export function toMinor(major: number | string): number {
  const n = typeof major === 'string' ? Number(major) : major
  if (!Number.isFinite(n)) throw new Error(`Invalid money value: ${major}`)
  return Math.round(n * MINOR_PER_MAJOR)
}

/** Convert minor units to a major-unit number. */
export function toMajor(minor: number): number {
  return minor / MINOR_PER_MAJOR
}

/**
 * Round a millitaka value to the nearest minor unit. Half-up.
 * Used after a 3-dp computation (e.g. 0.15 × 2.5 = 0.375 millitaka).
 */
export function roundMilliToMinor(milli: number): number {
  // milli here means 1/1000 of a taka. We want 1/100 of a taka, half-up.
  return Math.round(milli / 10)
}

/**
 * Apply a percentage rate to a minor-unit amount, computing at millitaka
 * (3 dp) precision then rounding per line to minor units. Returns the tax
 * in minor units.
 *
 * basisPoints is 1/100 of a percent (1500 = 15%, 750 = 7.5%).
 *
 * @example applyRate(10000, 1500) // 1500 (15% of 100.00 taka = 15.00)
 * @example applyRate(250, 750)   // 19 (7.5% of 2.50 taka = 0.1875 → 0.19 → 19 minor)
 */
export function applyRate(minor: number, basisPoints: number): number {
  // minor is 1/100 of a taka; minor × bps/1000 = millitaka (1/1000).
  const taxMilli = (minor * basisPoints) / 1000
  return roundMilliToMinor(taxMilli)
}

/** Sum debits; must equal sum of credits at post. */
export function sumDebit(entries: { debit: number }[]): number {
  let s = 0
  for (const e of entries) s += e.debit
  return s
}

export function sumCredit(entries: { credit: number }[]): number {
  let s = 0
  for (const e of entries) s += e.credit
  return s
}

export function isBalanced(entries: { debit: number; credit: number }[]): boolean {
  return sumDebit(entries) === sumCredit(entries)
}

/** Per-line residual that must be posted to the Rounding Difference account. */
export function roundingResidual(
  entries: { debit: number; credit: number }[],
): number {
  const d = sumDebit(entries)
  const c = sumCredit(entries)
  return d - c
}
