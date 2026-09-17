/**
 * Money handling for NeuroBook.
 *
 * Rule §15.1 R7: all money is stored as integer minor units (taka × 100).
 * No float/double columns and no raw `Number` arithmetic in any money path.
 *
 * Why integers: 0.1 + 0.2 !== 0.3 in IEEE-754. Over hundreds of thousands of
 * vouchers that drift makes a trial balance stop footing, and reports stop
 * agreeing with the ledger. For accounting software that is a compliance
 * failure, not a cosmetic one.
 */

/** Money in minor units (poisha). 1 taka === 100 minor units. */
export type MinorUnits = bigint;

/** A rate or quantity precision higher than minor units. Tax is computed here. */
export type MilliUnits = bigint;

export const MINOR_PER_TAKA = 100n;
export const MILLI_PER_MINOR = 1000n;

/**
 * Multiplies a minor-unit amount by a decimal rate, computing in millitaka
 * (3 dp) and rounding half-up to minor units.
 *
 * This is the ONLY place in the codebase where a decimal rate meets a money
 * amount. Everything else is integer arithmetic on minor units.
 *
 * The 3 dp working precision is not arbitrary: the reduced VAT band is 7.5%,
 * and 0.075 × an integer need not terminate at 2 dp (e.g. 7.5% of 2.50 = 0.1875).
 * Fractional quantities reach 3 dp on their own (0.15 × 2.5 = 0.375).
 */
export function applyRate(amount: MinorUnits, rateBps: number): MinorUnits {
  if (rateBps < 0) throw new TypeError(`rate must be non-negative, got ${rateBps}`);
  // rateBps is basis points: 15% === 1500, 7.5% === 750.
  // A minor unit is 1/100 taka and the rate factor is bps / 10000, so the
  // exact result in minor units is amount × bps / 10000. Adding 5000 before
  // the integer division rounds half-up instead of truncating, so
  // 7.5% of 250 → 18.75 → 19, not 18.
  const bps = BigInt(Math.round(rateBps));
  return (amount * bps + 5000n) / 10000n;
}

/** Round a millitaka value half-up to minor units. */
export function roundMilliToMinor(milli: MilliUnits): MinorUnits {
  const half = MILLI_PER_MINOR / 2n;
  const sign = milli < 0n ? -1n : 1n;
  const abs = milli < 0n ? -milli : milli;
  return sign * ((abs + half) / MILLI_PER_MINOR);
}

/** Round half-up to whole minor units. Use only on values already in minor units. */
export function roundMinor(units: number): MinorUnits {
  if (!Number.isFinite(units)) throw new TypeError("money must be finite");
  return BigInt(Math.round(units));
}

/** Add two minor-unit amounts. */
export function add(a: MinorUnits, b: MinorUnits): MinorUnits {
  return a + b;
}

/** Subtract two minor-unit amounts. */
export function sub(a: MinorUnits, b: MinorUnits): MinorUnits {
  return a - b;
}

/**
 * Sum an iterable of minor-unit amounts. Integer arithmetic throughout — no
 * intermediate float, no accumulation error.
 */
export function sumMinor(amounts: Iterable<MinorUnits>): MinorUnits {
  let total = 0n;
  for (const a of amounts) total += a;
  return total;
}

export const ZERO = 0n;
