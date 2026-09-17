/**
 * Bangladesh number and date formatting (§15.4 U3).
 *
 * One formatter, used everywhere — the UI, the PDF exports and the Excel
 * exports — so a figure cannot appear as 1,000,000 in one place and 10,00,000
 * in another. Bangladesh uses the lakh/crore grouping and `dd/mm/yy` dates.
 */
const BD_LOCALE = "en-IN";

/** Locale-aware digit grouping: 1000000 -> "10,00,000". */
export function formatTaka(minorUnits: number): string {
  const taka = minorUnits / 100;
  return new Intl.NumberFormat(BD_LOCALE, {
    minimumFractionDigits: taka % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(taka);
}

/** A signed amount, for ledger balances that can fall either side of zero. */
export function formatSignedTaka(minorUnits: number): string {
  return minorUnits < 0 ? `(${formatTaka(-minorUnits)})` : formatTaka(minorUnits);
}

/**
 * Split a date-only string into its parts without a timezone round-trip.
 *
 * `new Date("2026-07-15")` parses as UTC midnight, so `getDate()` in a timezone
 * west of UTC returns the previous day. A date-only string carries no time, so
 * it is read field by field instead. A Date object is used as-is: those come
 * from a timestamp and already have an unambiguous instant.
 */
function dateParts(input: string | Date): { day: number; month: number; year: number } | null {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime())
      ? null
      : { day: input.getDate(), month: input.getMonth() + 1, year: input.getFullYear() };
  }
  const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match || !match[1] || !match[2] || !match[3]) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** `dd/mm/yy` — the form a Bangladeshi business reads. */
export function formatDate(input: string | Date): string {
  const parts = dateParts(input);
  if (!parts) return "";
  const dd = String(parts.day).padStart(2, "0");
  const mm = String(parts.month).padStart(2, "0");
  const yy = String(parts.year).slice(2);
  return `${dd}/${mm}/${yy}`;
}

/** `dd/mm/yyyy` for documents that carry a full year. */
export function formatLongDate(input: string | Date): string {
  const parts = dateParts(input);
  if (!parts) return "";
  const dd = String(parts.day).padStart(2, "0");
  const mm = String(parts.month).padStart(2, "0");
  return `${dd}/${mm}/${parts.year}`;
}

/**
 * Parse a user-typed date in either `dd/mm/yy` or `dd/mm/yyyy`, returning the
 * ISO value an input expects. A two-digit year maps to the current century.
 */
export function parseBdDate(input: string): string {
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  const dd = match?.[1];
  const mm = match?.[2];
  const yy = match?.[3];
  if (!dd || !mm || !yy) return "";
  const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
  const date = new Date(Date.UTC(year, Number(mm) - 1, Number(dd)));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
