// Re-export shared formatters for convenience. Mobile components import
// from @neurobook/shared/format, but this gives a stable @/lib/format path.
export { formatTaka, formatTakaFromMinor, formatLakhCrore, formatDateBd, currentFiscalYear } from '@neurobook/shared/format'
